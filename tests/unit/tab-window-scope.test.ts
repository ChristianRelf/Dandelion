import { describe, expect, it, vi } from 'vitest';

// TabManager imports `WebContentsView` at module scope. Nothing here reaches it:
// every tab stays on the internal new-tab page, which `activate` renders in the
// chrome rather than a web view.
vi.mock('electron', () => ({ WebContentsView: class {}, WebContents: class {} }));

const { TabManager } = await import('@main/browser/tab-manager');
import { INTERNAL_PAGES } from '@shared/constants';
import type { TabManagerDeps } from '@main/browser/tab-manager';
import type { PersistedTab } from '@main/storage';

const WORKSPACE = 'workspace_1';

/** A window with only the fields `activate`/`layout`/`restoreWorkspace` read. */
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

function makeManager(persisted: PersistedTab[] = []) {
  const windows = new Map([
    ['window_1', fakeWindow('window_1')],
    ['window_2', fakeWindow('window_2')],
  ]);
  const stored = new Map(persisted.map((record) => [record.id, record]));

  const deps = {
    windows: {
      get: (id: string) => windows.get(id) ?? null,
      first: () => windows.get('window_1'),
      broadcastState: () => {},
      onWindowClosed: () => {},
    },
    permissions: { setTabResolver: () => {} },
    workspaces: { get: () => ({ id: WORKSPACE, profileId: 'profile_1' }) },
    profiles: { get: () => ({ id: 'profile_1', isPrivate: false }) },
    settings: { get: () => ({ behavior: { newTabPage: INTERNAL_PAGES.newTab } }) },
    repos: {
      tabs: {
        listByWorkspace: () => [...stored.values()],
        upsert: (record: PersistedTab) => stored.set(record.id, record),
        remove: (id: string) => stored.delete(id),
        listGroups: () => [],
      },
    },
    events: { emit: () => {} },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as TabManagerDeps;

  return { manager: new TabManager(deps), windows };
}

function persistedTab(id: string, index: number): PersistedTab {
  return {
    id,
    workspaceId: WORKSPACE,
    groupId: null,
    index,
    url: INTERNAL_PAGES.newTab,
    title: 'New Tab',
    favicon: null,
    pinned: false,
    createdAt: 0,
    lastActiveAt: 0,
  };
}

describe('TabManager.restoreWorkspace — window scoping', () => {
  // The defect: `alreadyOpen` read every window's tabs, so a second window
  // opening the same workspace adopted a tab out of the window showing it.
  // Window 1 was left blank while its strip still drew the tab as active.
  it('does not move another window’s tab into the window being restored', () => {
    const { manager } = makeManager();
    manager.restoreWorkspace('window_1', WORKSPACE);
    const [original] = manager.listInWindow('window_1', WORKSPACE);
    expect(original).toBeDefined();

    manager.restoreWorkspace('window_2', WORKSPACE);

    expect(manager.listInWindow('window_1', WORKSPACE).map((tab) => tab.id)).toEqual([
      original!.id,
    ]);
    expect(original!.windowId).toBe('window_1');
  });

  it('gives a window opening an occupied workspace a fresh tab of its own', () => {
    const { manager } = makeManager();
    manager.restoreWorkspace('window_1', WORKSPACE);
    manager.restoreWorkspace('window_2', WORKSPACE);

    const second = manager.listInWindow('window_2', WORKSPACE);
    expect(second).toHaveLength(1);
    expect(second[0]!.id).not.toBe(manager.listInWindow('window_1', WORKSPACE)[0]!.id);
  });

  // Window-scoping `alreadyOpen` alone would fall through to the persisted
  // branch and re-materialise the very tabs window 1 is already showing.
  it('does not duplicate persisted tabs that are already live elsewhere', () => {
    const { manager } = makeManager([persistedTab('tab_a', 0), persistedTab('tab_b', 1)]);
    manager.restoreWorkspace('window_1', WORKSPACE);
    expect(manager.listInWindow('window_1', WORKSPACE).map((tab) => tab.id)).toEqual([
      'tab_a',
      'tab_b',
    ]);

    manager.restoreWorkspace('window_2', WORKSPACE);

    expect(manager.listInWindow('window_1', WORKSPACE).map((tab) => tab.id)).toEqual([
      'tab_a',
      'tab_b',
    ]);
    const second = manager.listInWindow('window_2', WORKSPACE);
    expect(second).toHaveLength(1);
    expect(['tab_a', 'tab_b']).not.toContain(second[0]!.id);
  });

  it('restores persisted tabs into the first window that claims them', () => {
    const { manager } = makeManager([persistedTab('tab_a', 0), persistedTab('tab_b', 1)]);
    manager.restoreWorkspace('window_2', WORKSPACE);
    expect(manager.listInWindow('window_2', WORKSPACE).map((tab) => tab.id)).toEqual([
      'tab_a',
      'tab_b',
    ]);
    expect(manager.listInWindow('window_1', WORKSPACE)).toHaveLength(0);
  });

  // A renderer reload re-runs restore for the workspace already on screen.
  it('is idempotent for the workspace a window already shows', () => {
    const { manager } = makeManager();
    manager.restoreWorkspace('window_1', WORKSPACE);
    const before = manager.listInWindow('window_1', WORKSPACE);
    manager.restoreWorkspace('window_1', WORKSPACE);
    expect(manager.listInWindow('window_1', WORKSPACE).map((tab) => tab.id)).toEqual(
      before.map((tab) => tab.id),
    );
  });
});
