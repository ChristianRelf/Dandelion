import { describe, expect, it, vi } from 'vitest';

type PrintCallback = (success: boolean, failureReason: string) => void;

const printCalls: Array<{ callback: PrintCallback }> = [];

/**
 * Rich enough for `materialize` to build a view: `wireWebContents` only ever
 * registers listeners, and `layout` only ever positions the view.
 */
function fakeWebContents() {
  return {
    on: vi.fn(),
    once: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    loadURL: vi.fn(),
    setAudioMuted: vi.fn(),
    setVisualZoomLevelLimits: vi.fn(),
    print: vi.fn((_options: unknown, callback: PrintCallback) => {
      printCalls.push({ callback });
    }),
    session: { webRequest: { onBeforeRequest: vi.fn(), onHeadersReceived: vi.fn() } },
  };
}

vi.mock('electron', () => ({
  WebContentsView: class {
    webContents = fakeWebContents();
    setVisible = vi.fn();
    setBounds = vi.fn();
    setBackgroundColor = vi.fn();
    setBorderRadius = vi.fn();
  },
  WebContents: class {},
}));

const { TabManager } = await import('@main/browser/tab-manager');
import { INTERNAL_PAGES } from '@shared/constants';
import type { TabManagerDeps } from '@main/browser/tab-manager';

const WORKSPACE = 'workspace_1';

function makeManager() {
  const dandelionWindow = {
    id: 'window_1',
    activeTabId: null as string | null,
    activeWorkspaceId: null as string | null,
    splitTabIds: [] as string[],
    splitOrientation: 'vertical',
    splitRatio: 0.5,
    contentHidden: false,
    contentBounds: { x: 0, y: 0, width: 800, height: 600 },
    browserWindow: { contentView: { addChildView: () => {}, removeChildView: () => {} } },
  };
  const warnings: string[] = [];

  const deps = {
    windows: {
      get: () => dandelionWindow,
      first: () => dandelionWindow,
      broadcastState: () => {},
      onWindowClosed: () => {},
    },
    permissions: { setTabResolver: () => {} },
    workspaces: { get: () => ({ id: WORKSPACE, profileId: 'profile_1' }) },
    profiles: { get: () => ({ id: 'profile_1', isPrivate: false }) },
    sessions: { getSession: () => ({}) },
    settings: {
      get: () => ({
        behavior: { newTabPage: INTERNAL_PAGES.newTab },
        appearance: { cornerRadius: 12 },
      }),
    },
    repos: {
      tabs: { listByWorkspace: () => [], upsert: () => {}, remove: () => {}, listGroups: () => [] },
    },
    events: { emit: () => {} },
    logger: { info: () => {}, warn: (message: string) => warnings.push(message), error: () => {} },
  } as unknown as TabManagerDeps;

  return { manager: new TabManager(deps), warnings };
}

/**
 * `tools.print` (⌘P) forwarded to the renderer, which had no handler for it — a
 * dead command. Printing is now answered in main, where the page's webContents
 * lives, and reports whether there was anything to print at all.
 */
describe('TabManager.print', () => {
  it('prints the active tab through its view', () => {
    printCalls.length = 0;
    const { manager } = makeManager();
    const tab = manager.createTab({
      workspaceId: WORKSPACE,
      windowId: 'window_1',
      url: 'https://example.com',
      active: true,
    });

    expect(manager.print(tab.id)).toBe(true);
    expect(printCalls).toHaveLength(1);
  });

  // The browser's own pages are drawn by the chrome renderer and have no view of
  // their own, so there is nothing to hand to Chromium's print dialog. The point
  // is that this reports rather than throws, so the renderer can say so.
  it('reports that an internal page has nothing to print, without throwing', () => {
    printCalls.length = 0;
    const { manager } = makeManager();
    const tab = manager.createTab({
      workspaceId: WORKSPACE,
      windowId: 'window_1',
      url: INTERNAL_PAGES.settings,
      active: true,
    });

    expect(manager.print(tab.id)).toBe(false);
    expect(printCalls).toHaveLength(0);
  });

  it('reports an unknown tab rather than throwing', () => {
    const { manager } = makeManager();
    expect(manager.print('tab_does_not_exist')).toBe(false);
  });

  it('does not log the user dismissing the print dialog as a failure', () => {
    printCalls.length = 0;
    const { manager, warnings } = makeManager();
    const tab = manager.createTab({
      workspaceId: WORKSPACE,
      windowId: 'window_1',
      url: 'https://example.com',
      active: true,
    });
    manager.print(tab.id);

    printCalls[0]?.callback(false, 'cancelled');
    expect(warnings).toEqual([]);

    printCalls[0]?.callback(false, 'failed');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('failed');
  });
});
