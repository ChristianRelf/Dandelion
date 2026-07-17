import { describe, expect, it, vi } from 'vitest';

/**
 * These tabs sit on web URLs, so each one that loads materialises a real view.
 * The fake models the slice of `WebContentsView` the load path touches, and lets
 * a test emit `did-stop-loading` to settle a load and free a scheduler slot.
 */
const electron = vi.hoisted(() => {
  const views: FakeWebContentsView[] = [];
  let nextId = 1;

  class FakeWebContents {
    readonly id = nextId++;
    opener: unknown = null;
    readonly navigationHistory = { canGoBack: () => false, canGoForward: () => false };
    private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    on(event: string, listener: (...args: unknown[]) => void): this {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
      return this;
    }
    emit(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) ?? []) listener(...args);
    }
    setWindowOpenHandler(): void {}
    loadURL(): Promise<void> {
      return Promise.resolve();
    }
    isDestroyed(): boolean {
      return false;
    }
    destroy(): void {}
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

  return { views, FakeWebContentsView };
});

vi.mock('electron', () => ({
  WebContentsView: electron.FakeWebContentsView,
  webContents: { fromFrame: vi.fn(() => undefined) },
}));

const { TabManager } = await import('@main/browser/tab-manager');
import type { TabManagerDeps } from '@main/browser/tab-manager';
import { INTERNAL_PAGES, LIMITS } from '@shared/constants';

const WORKSPACE = 'workspace_1';
const CAP = LIMITS.maxConcurrentTabLoads;

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
  const windows = new Map([['window_1', fakeWindow('window_1')]]);

  const deps = {
    windows: {
      get: (id: string) => windows.get(id) ?? null,
      first: () => windows.get('window_1'),
      broadcastState: () => {},
      onWindowClosed: () => {},
    },
    permissions: { setTabResolver: () => {} },
    sessions: { getSession: () => ({}) },
    privacy: { resetCounters: () => {} },
    history: { setTitle: () => {}, setFavicon: () => {}, record: () => {} },
    workspaces: { get: () => ({ id: WORKSPACE, profileId: 'profile_1' }) },
    profiles: { get: () => ({ id: 'profile_1', isPrivate: false }) },
    settings: {
      get: () => ({
        behavior: { newTabPage: INTERNAL_PAGES.newTab },
        appearance: { cornerRadius: 8 },
      }),
    },
    repos: {
      tabs: { listByWorkspace: () => [], upsert: () => {}, remove: () => {}, listGroups: () => [] },
    },
    events: { emit: () => {} },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  } as unknown as TabManagerDeps;

  return { manager: new TabManager(deps), windows };
}

/** Open one foreground tab on a distinct web URL, as a `window.open` burst would. */
function openForeground(manager: InstanceType<typeof TabManager>, n: number) {
  return manager.createTab({
    workspaceId: WORKSPACE,
    windowId: 'window_1',
    url: `https://example.com/${n}`,
    active: true,
  });
}

describe('TabManager — throttling a burst of foreground opens', () => {
  it('materialises at most the concurrency cap, however many open at once', () => {
    const { manager } = makeManager();

    for (let n = 0; n < CAP + 20; n++) openForeground(manager, n);

    // The freeze this prevents: a view (renderer process) per tab, all at once.
    expect(electron.views.length).toBe(CAP);
  });

  it('loads the tab left on screen when a slot frees, skipping superseded ones', () => {
    const { manager } = makeManager();

    const tabs = Array.from({ length: CAP + 5 }, (_, n) => openForeground(manager, n));
    const onScreen = tabs[tabs.length - 1]!; // the last opened is the active tab

    // It is queued behind the cap, so it has not loaded yet.
    expect(manager.get(onScreen.id)?.status).toBe('idle');
    expect(electron.views.length).toBe(CAP);

    // One of the first loads finishes, freeing a slot.
    electron.views[0]!.webContents.emit('did-stop-loading');

    // The on-screen tab loads; the superseded queued tabs in between are skipped.
    expect(manager.get(onScreen.id)?.status).toBe('loading');
    expect(electron.views.length).toBe(CAP + 1);
  });

  it('lets a normal handful of tabs all load immediately', () => {
    const { manager } = makeManager();

    for (let n = 0; n < CAP; n++) openForeground(manager, n);

    expect(electron.views.length).toBe(CAP);
  });
});
