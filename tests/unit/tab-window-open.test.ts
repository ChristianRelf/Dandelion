import { describe, expect, it, vi } from 'vitest';

/**
 * Exercises the `setWindowOpenHandler` a materialised tab installs: how the
 * browser answers `window.open` for OAuth popups, blob downloads, `_blank`
 * links and disallowed schemes. The fake captures the handler so a test can call
 * it directly.
 */
type OpenDetails = { url: string; disposition: string };
type OpenResult = {
  action: string;
  overrideBrowserWindowOptions?: { webPreferences?: { session?: unknown } };
};

const electron = vi.hoisted(() => {
  const views: FakeWebContentsView[] = [];
  const openHandlers: Array<(details: OpenDetails) => OpenResult> = [];
  let nextId = 1;

  class FakeWebContents {
    readonly id = nextId++;
    opener: unknown = null;
    readonly navigationHistory = { canGoBack: () => false, canGoForward: () => false };
    on(): this {
      return this;
    }
    setWindowOpenHandler(handler: (details: OpenDetails) => OpenResult): void {
      openHandlers.push(handler);
    }
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

  return { views, openHandlers, FakeWebContentsView };
});

vi.mock('electron', () => ({
  WebContentsView: electron.FakeWebContentsView,
  webContents: { fromFrame: vi.fn(() => undefined) },
}));

const { TabManager } = await import('@main/browser/tab-manager');
import type { TabManagerDeps } from '@main/browser/tab-manager';
import { INTERNAL_PAGES } from '@shared/constants';

const WORKSPACE = 'workspace_1';
const PAGE = 'https://example.com/';
/** Sentinel the fake session manager hands back, so tests can assert it is wired through. */
const SESSION = { id: 'session-sentinel' };

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
  electron.openHandlers.length = 0;
  const windows = new Map([['window_1', fakeWindow('window_1')]]);
  const popupRules: string[] = [];

  const deps = {
    windows: {
      get: (id: string) => windows.get(id) ?? null,
      first: () => windows.get('window_1'),
      broadcastState: () => {},
      onWindowClosed: () => {},
    },
    permissions: {
      setTabResolver: () => {},
      decisionFor: () => null,
      set: (_p: string, _o: string, kind: string) => popupRules.push(kind),
    },
    sessions: { getSession: () => SESSION },
    privacy: { resetCounters: () => {} },
    history: { setTitle: () => {}, setFavicon: () => {}, record: () => {} },
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
  manager.createTab({ workspaceId: WORKSPACE, windowId: 'window_1', url: PAGE });
  const handler = electron.openHandlers[0]!;
  return { manager, handler };
}

describe('TabManager — window.open handler', () => {
  // The Google sign-in fix: the OAuth popup must share the opener's *configured*
  // session (stock UA, shared cookies), not fall back to the default one.
  it('gives an OAuth popup the profile session', () => {
    const { handler } = makeManager();
    const result = handler({
      url: 'https://accounts.google.com/o/oauth2/auth',
      disposition: 'new-window',
    });
    expect(result.action).toBe('allow');
    expect(result.overrideBrowserWindowOptions?.webPreferences?.session).toBe(SESSION);
  });

  // The download fix: window.open(URL.createObjectURL(blob)) must not be denied,
  // or the page's own script throws on a null return.
  it('allows a blob: download to open, with the profile session', () => {
    const { handler } = makeManager();
    const result = handler({
      url: 'blob:https://example.com/abc-123',
      disposition: 'foreground-tab',
    });
    expect(result.action).toBe('allow');
    expect(result.overrideBrowserWindowOptions?.webPreferences?.session).toBe(SESSION);
  });

  it('opens a _blank link as a tab', () => {
    const { manager, handler } = makeManager();
    const before = manager.listByWorkspace(WORKSPACE).length;
    const result = handler({ url: 'https://other.example/page', disposition: 'foreground-tab' });
    // The tab is created; window.open itself is answered with deny.
    expect(result.action).toBe('deny');
    expect(manager.listByWorkspace(WORKSPACE).length).toBe(before + 1);
  });

  it('denies window.open to a privileged internal scheme', () => {
    const { handler } = makeManager();
    expect(handler({ url: 'dandelion://passwords', disposition: 'foreground-tab' }).action).toBe(
      'deny',
    );
  });
});
