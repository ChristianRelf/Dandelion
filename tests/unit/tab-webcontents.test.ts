import { describe, expect, it, vi } from 'vitest';

/**
 * Unlike the other TabManager suites, these tabs sit on web URLs and so
 * materialise a real view. The fakes model the slice of `WebContentsView` that
 * `wireWebContents` and `destroyView` touch — including `destroy()` emitting
 * `destroyed`, which is Electron's contract and what frees the shield counters.
 */
const electron = vi.hoisted(() => {
  const views: FakeWebContentsView[] = [];
  let nextId = 1;

  class FakeWebContents {
    readonly id = nextId++;
    opener: unknown = null;
    readonly navigationHistory = { canGoBack: () => false, canGoForward: () => false };
    private readonly listeners = new Map<string, Array<() => void>>();
    private destroyed = false;

    on(event: string, listener: () => void): this {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
      return this;
    }
    setWindowOpenHandler(): void {}
    loadURL(): Promise<void> {
      return Promise.resolve();
    }
    isDestroyed(): boolean {
      return this.destroyed;
    }
    destroy(): void {
      this.destroyed = true;
      for (const listener of this.listeners.get('destroyed') ?? []) listener();
    }
  }

  class FakeWebContentsView {
    readonly webContents = new FakeWebContents();
    constructor() {
      views.push(this);
    }
    setVisible(): void {}
    setBounds(): void {}
    setBorderRadius(): void {}
  }

  return {
    views,
    FakeWebContentsView,
    fromFrame: vi.fn<(frame: unknown) => unknown>(() => undefined),
  };
});

vi.mock('electron', () => ({
  WebContentsView: electron.FakeWebContentsView,
  webContents: { fromFrame: electron.fromFrame },
}));

const { TabManager } = await import('@main/browser/tab-manager');
import type { TabManagerDeps } from '@main/browser/tab-manager';
import type { RequestingTab } from '@main/services/permissions.service';
import { INTERNAL_PAGES } from '@shared/constants';

const WORKSPACE = 'workspace_1';
const PAGE = 'https://example.com/';

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

function makeManager() {
  electron.views.length = 0;
  electron.fromFrame.mockReset();
  electron.fromFrame.mockReturnValue(undefined);

  const windows = new Map([['window_1', fakeWindow('window_1')]]);
  /** webContents ids whose shield counters were released. */
  const freed: number[] = [];
  let resolveTab: ((contents: unknown) => RequestingTab | null) | null = null;
  let closeWindow: ((windowId: string) => void) | null = null;

  const deps = {
    windows: {
      get: (id: string) => windows.get(id) ?? null,
      first: () => windows.get('window_1'),
      broadcastState: () => {},
      onWindowClosed: (handler: (windowId: string) => void) => {
        closeWindow = handler;
      },
    },
    permissions: {
      setTabResolver: (resolver: (contents: unknown) => RequestingTab | null) => {
        resolveTab = resolver;
      },
    },
    sessions: { getSession: () => ({}) },
    privacy: { resetCounters: (id: number) => freed.push(id) },
    history: { setTitle: () => {}, setFavicon: () => {}, recordVisit: () => {} },
    workspaces: { get: () => ({ id: WORKSPACE, profileId: 'profile_1' }) },
    profiles: { get: () => ({ id: 'profile_1', isPrivate: false }) },
    settings: {
      get: () => ({
        behavior: { newTabPage: INTERNAL_PAGES.newTab },
        appearance: { cornerRadius: 8 },
        privacy: { spoofChromeIdentity: false },
      }),
    },
    repos: {
      tabs: { listByWorkspace: () => [], upsert: () => {}, remove: () => {}, listGroups: () => [] },
    },
    events: { emit: () => {} },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as TabManagerDeps;

  const manager = new TabManager(deps);
  return {
    manager,
    freed,
    resolveTab: (contents: unknown) => resolveTab?.(contents) ?? null,
    closeWindow: (windowId: string) => closeWindow?.(windowId),
  };
}

/** A tab on a real page, so it materialises a view. */
function openPage(manager: InstanceType<typeof TabManager>) {
  return manager.createTab({ workspaceId: WORKSPACE, windowId: 'window_1', url: PAGE });
}

describe('TabManager — resolving a permission request to a window', () => {
  it('resolves a tab’s own webContents to the tab and the window showing it', () => {
    const { manager, resolveTab } = makeManager();
    const tab = openPage(manager);

    expect(resolveTab(electron.views[0]!.webContents)).toEqual({
      tabId: tab.id,
      windowId: 'window_1',
    });
  });

  // A popup shares its opener's session, so it reaches the session's permission
  // handler with a webContents that belongs to no tab. It has no chrome of its
  // own to prompt in, so it answers as the tab that opened it.
  it('resolves a popup to the tab that opened it', () => {
    const { manager, resolveTab } = makeManager();
    const tab = openPage(manager);
    const openerFrame = {};
    electron.fromFrame.mockImplementation((frame) =>
      frame === openerFrame ? electron.views[0]!.webContents : undefined,
    );

    expect(resolveTab({ opener: openerFrame })).toEqual({ tabId: tab.id, windowId: 'window_1' });
  });

  it('returns nothing for a webContents no tab owns and nothing opened', () => {
    const { manager, resolveTab } = makeManager();
    openPage(manager);
    expect(resolveTab({ opener: null })).toBeNull();
  });
});

describe('TabManager — freeing shield counters', () => {
  // The defect: `PrivacyService.counters` is keyed by webContents id and
  // `resetCounters` was only ever reached from `did-start-navigation`. Nothing
  // freed an entry when a view went, so the map gained one per webContents ever
  // created and never lost one — unbounded across a long session.
  it('frees a tab’s counters when it is closed', () => {
    const { manager, freed } = makeManager();
    const tab = openPage(manager);
    const { id } = electron.views[0]!.webContents;

    manager.close(tab.id);

    expect(freed).toContain(id);
  });

  // Sleeping destroys the view and keeps the tab: the counters belong to the
  // webContents, not the tab, and a woken tab gets a fresh one.
  it('frees them when a tab is slept', () => {
    const { manager, freed } = makeManager();
    const first = openPage(manager);
    openPage(manager); // takes over as the window's active tab
    const { id } = electron.views[0]!.webContents;

    manager.sleep(first.id);

    expect(freed).toContain(id);
  });

  it('frees every tab’s counters when the window goes', () => {
    const { manager, freed, closeWindow } = makeManager();
    openPage(manager);
    openPage(manager);
    const ids = electron.views.map((view) => view.webContents.id);

    closeWindow('window_1');

    expect(freed).toEqual(expect.arrayContaining(ids));
  });
});
