import { describe, expect, it, vi } from 'vitest';

// Every tab here stays on the internal new-tab page, which `activate` renders in
// the chrome rather than a web view — so nothing reaches WebContentsView.
vi.mock('electron', () => ({ WebContentsView: class {}, WebContents: class {} }));

const { TabManager } = await import('@main/browser/tab-manager');
import { INTERNAL_PAGES } from '@shared/constants';
import type { TabManagerDeps } from '@main/browser/tab-manager';
import type { BrowserEvent } from '@shared/types';

const WORKSPACE = 'workspace_1';

function fakeWindow(id: string) {
  return {
    id,
    activeTabId: null as string | null,
    activeWorkspaceId: null as string | null,
    splitTabIds: [] as string[],
    splitOrientation: 'vertical',
    splitRatio: 0.5,
    contentHidden: false,
    contentBounds: { x: 0, y: 0, width: 800, height: 600 },
    browserWindow: { contentView: { addChildView: () => {}, removeChildView: () => {} } },
  };
}

function makeManager({ isPrivate = false } = {}) {
  const windows = new Map([['window_1', fakeWindow('window_1')]]);
  const emitted: BrowserEvent[] = [];

  const deps = {
    windows: {
      get: (id: string) => windows.get(id) ?? null,
      first: () => windows.get('window_1'),
      broadcastState: () => {},
      onWindowClosed: () => {},
    },
    permissions: { setTabResolver: () => {} },
    workspaces: { get: () => ({ id: WORKSPACE, profileId: 'profile_1' }) },
    profiles: { get: () => ({ id: 'profile_1', isPrivate }) },
    settings: { get: () => ({ behavior: { newTabPage: INTERNAL_PAGES.newTab } }) },
    repos: {
      tabs: { listByWorkspace: () => [], upsert: () => {}, remove: () => {}, listGroups: () => [] },
    },
    events: { emit: (event: BrowserEvent) => emitted.push(event) },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as TabManagerDeps;

  return { manager: new TabManager(deps), emitted, windows };
}

/** Three tabs at 0, 1, 2 — the arrangement the index bug reordered. */
function seedThree(manager: InstanceType<typeof TabManager>) {
  const a = manager.createTab({ workspaceId: WORKSPACE, windowId: 'window_1', active: false });
  const b = manager.createTab({ workspaceId: WORKSPACE, windowId: 'window_1', active: false });
  const c = manager.createTab({ workspaceId: WORKSPACE, windowId: 'window_1', active: false });
  return { a, b, c };
}

describe('TabManager.duplicate — index collisions', () => {
  // The defect: `duplicate` asks for `index + 1` and `createTab` assigned it
  // verbatim without shifting siblings, so duplicating A in `A B C` gave both
  // the copy and B index 1. Sorts are stable, so the copy always landed *after*
  // the incumbent — never beside its source — and the collision was persisted.
  it('puts the copy directly after its source', () => {
    const { manager } = makeManager();
    const { a, b, c } = seedThree(manager);

    const copy = manager.duplicate(a.id)!;

    expect(manager.listInWindow('window_1', WORKSPACE).map((tab) => tab.id)).toEqual([
      a.id,
      copy.id,
      b.id,
      c.id,
    ]);
  });

  it('leaves every index distinct', () => {
    const { manager } = makeManager();
    const { b } = seedThree(manager);
    manager.duplicate(b.id);

    const indexes = manager.listInWindow('window_1', WORKSPACE).map((tab) => tab.index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('duplicating the last tab still appends', () => {
    const { manager } = makeManager();
    const { a, b, c } = seedThree(manager);
    const copy = manager.duplicate(c.id)!;
    expect(manager.listInWindow('window_1', WORKSPACE).map((tab) => tab.id)).toEqual([
      a.id,
      b.id,
      c.id,
      copy.id,
    ]);
  });
});

describe('TabManager.close — recently closed', () => {
  it('remembers a closed tab from a normal window', () => {
    const { manager } = makeManager();
    const tab = manager.createTab({
      workspaceId: WORKSPACE,
      windowId: 'window_1',
      url: 'https://example.com/',
      active: false,
    });
    manager.close(tab.id);
    expect(manager.recentlyClosedTabs()).toHaveLength(1);
  });

  // `persist()` and `recordVisit()` both guard on `isPrivate`; this did not, so
  // Ctrl+Shift+T in a normal window resurrected a tab closed in a private one.
  it('does not remember one closed in a private window', () => {
    const { manager } = makeManager({ isPrivate: true });
    const tab = manager.createTab({
      workspaceId: WORKSPACE,
      windowId: 'window_1',
      url: 'https://secret.example/',
      active: false,
    });
    manager.close(tab.id);
    expect(manager.recentlyClosedTabs()).toEqual([]);
  });
});

describe('TabManager.setSplit — pane wakefulness', () => {
  // A pane on screen is awake by definition. Only `activate` cleared `asleep`,
  // and `sleep()` refuses to touch a pane, so a restored tab — which arrives
  // asleep — rendered live content behind a dimmed strip row forever.
  it('wakes a sleeping tab promoted into a split', () => {
    const { manager, emitted } = makeManager();
    const { a, b } = seedThree(manager);
    manager.sleep(b.id);
    expect(manager.get(b.id)?.asleep).toBe(true);

    emitted.length = 0;
    manager.setSplit('window_1', [a.id, b.id], 'vertical');

    expect(manager.get(b.id)?.asleep).toBe(false);
    // And says so, or the strip never restyles.
    expect(emitted.some((event) => event.type === 'tab:updated' && event.tab.id === b.id)).toBe(
      true,
    );
  });
});
