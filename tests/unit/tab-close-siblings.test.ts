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
const OTHER_WORKSPACE = 'workspace_2';

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
    workspaces: { get: (id: string) => ({ id, profileId: 'profile_1' }) },
    profiles: { get: () => ({ id: 'profile_1', isPrivate: false }) },
    settings: { get: () => ({ behavior: { newTabPage: INTERNAL_PAGES.newTab } }) },
    repos: {
      tabs: {
        listByWorkspace: (workspaceId: string) =>
          [...stored.values()].filter((record) => record.workspaceId === workspaceId),
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

function persistedTab(id: string, index: number, workspaceId = WORKSPACE): PersistedTab {
  return {
    id,
    workspaceId,
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

/** Ids left in `window_1`'s strip, in strip order. */
function remaining(manager: InstanceType<typeof TabManager>, workspaceId = WORKSPACE): string[] {
  return manager.listInWindow('window_1', workspaceId).map((tab) => tab.id);
}

describe('TabManager.closeOthers / closeToRight', () => {
  // Both were renderer loops firing one `tabs.close` per tab. Main owns the
  // ordering, so it resolves the set once — which is also what lets the popup
  // surface, which holds no tab list, ask for either by tab id alone.
  it('closeOthers leaves only the subject', () => {
    const { manager } = makeManager([
      persistedTab('tab_a', 0),
      persistedTab('tab_b', 1),
      persistedTab('tab_c', 2),
    ]);
    manager.restoreWorkspace('window_1', WORKSPACE);

    manager.closeOthers('tab_b');

    expect(remaining(manager)).toEqual(['tab_b']);
  });

  it('closeToRight keeps the subject and everything before it', () => {
    const { manager } = makeManager([
      persistedTab('tab_a', 0),
      persistedTab('tab_b', 1),
      persistedTab('tab_c', 2),
      persistedTab('tab_d', 3),
    ]);
    manager.restoreWorkspace('window_1', WORKSPACE);

    manager.closeToRight('tab_b');

    expect(remaining(manager)).toEqual(['tab_a', 'tab_b']);
  });

  it('closeToRight on the last tab closes nothing', () => {
    const { manager } = makeManager([persistedTab('tab_a', 0), persistedTab('tab_b', 1)]);
    manager.restoreWorkspace('window_1', WORKSPACE);

    manager.closeToRight('tab_b');

    expect(remaining(manager)).toEqual(['tab_a', 'tab_b']);
  });

  // The reason the set is resolved before any of it is closed: `close()`
  // re-indexes the strip and can activate a neighbour, so a walk that read the
  // list as it went would be reading a list the walk was rewriting.
  it('closes every sibling rather than every other one', () => {
    const { manager } = makeManager(
      Array.from({ length: 6 }, (_, index) => persistedTab(`tab_${index}`, index)),
    );
    manager.restoreWorkspace('window_1', WORKSPACE);

    manager.closeOthers('tab_0');

    expect(remaining(manager)).toEqual(['tab_0']);
  });

  it('never reaches another workspace’s tabs', () => {
    const { manager } = makeManager([
      persistedTab('tab_a', 0),
      persistedTab('tab_b', 1),
      persistedTab('other_a', 0, OTHER_WORKSPACE),
    ]);
    manager.restoreWorkspace('window_1', WORKSPACE);
    manager.restoreWorkspace('window_2', OTHER_WORKSPACE);

    manager.closeOthers('tab_a');

    expect(remaining(manager)).toEqual(['tab_a']);
    expect(manager.listInWindow('window_2', OTHER_WORKSPACE).map((tab) => tab.id)).toEqual([
      'other_a',
    ]);
  });

  it('ignores a tab id that no longer exists', () => {
    const { manager } = makeManager([persistedTab('tab_a', 0), persistedTab('tab_b', 1)]);
    manager.restoreWorkspace('window_1', WORKSPACE);

    expect(() => manager.closeOthers('tab_gone')).not.toThrow();
    expect(remaining(manager)).toEqual(['tab_a', 'tab_b']);
  });
});
