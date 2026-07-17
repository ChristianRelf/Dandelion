import { app } from 'electron';
import { IPC } from '@shared/ipc/channels';
import type { AppContext } from './app-context';
import type { DandelionWindow } from '../browser/dandelion-window';

/**
 * `tab.select.1` … `tab.select.8`. Deliberately digits-only: `tab.select.last`
 * shares the prefix but is answered by the switch below, and a looser test would
 * swallow it.
 */
const TAB_ORDINAL_COMMAND = /^tab\.select\.(\d+)$/;

/**
 * Executes a command by id. Navigation/tab/window commands act directly on the
 * main-process managers so they work even while web content is focused; UI
 * commands (palette, address bar, sidebar) are focused-and-forwarded to the
 * owning renderer as an `app:command` event.
 */
export function executeCommand(ctx: AppContext, commandId: string, windowId: string | null): void {
  const dandelionWindow = windowId ? ctx.windows.get(windowId) : ctx.windows.first();
  const workspaceId = dandelionWindow?.activeWorkspaceId ?? null;
  const activeTabId = dandelionWindow?.activeTabId ?? null;

  const forwardToRenderer = (): void => {
    if (!dandelionWindow) return;
    dandelionWindow.browserWindow.webContents.focus();
    dandelionWindow.browserWindow.webContents.send(IPC.event, { type: 'app:command', commandId });
  };

  const ordinalMatch = TAB_ORDINAL_COMMAND.exec(commandId);
  if (ordinalMatch) {
    selectTabByOrdinal(ctx, dandelionWindow, Number(ordinalMatch[1]) - 1);
    return;
  }

  switch (commandId) {
    case 'tab.new':
      if (workspaceId && dandelionWindow) {
        ctx.tabs.createTab({ workspaceId, active: true, windowId: dandelionWindow.id });
      }
      return;
    case 'tab.close':
      if (activeTabId) ctx.tabs.close(activeTabId);
      return;
    case 'tab.reopenClosed':
      ctx.tabs.reopenClosed(dandelionWindow?.id);
      return;
    case 'tab.duplicate':
      if (activeTabId) ctx.tabs.duplicate(activeTabId);
      return;
    case 'tab.pin':
      toggleFlag(ctx, activeTabId, 'pinned');
      return;
    case 'tab.mute':
      toggleFlag(ctx, activeTabId, 'muted');
      return;
    case 'tab.sleep':
      if (activeTabId) ctx.tabs.sleep(activeTabId);
      return;
    case 'tab.next':
      cycleTab(ctx, dandelionWindow, 1);
      return;
    case 'tab.previous':
      cycleTab(ctx, dandelionWindow, -1);
      return;
    case 'tab.select.last':
      selectTabByOrdinal(ctx, dandelionWindow, -1);
      return;

    case 'navigation.back':
      if (activeTabId) ctx.tabs.goToOffset(activeTabId, -1);
      return;
    case 'navigation.forward':
      if (activeTabId) ctx.tabs.goToOffset(activeTabId, 1);
      return;
    case 'navigation.reload':
      if (activeTabId) ctx.tabs.reload(activeTabId, false);
      return;
    case 'navigation.hardReload':
      if (activeTabId) ctx.tabs.reload(activeTabId, true);
      return;
    case 'navigation.stop':
      if (activeTabId) ctx.tabs.stop(activeTabId);
      return;
    case 'navigation.home':
      if (activeTabId) ctx.tabs.navigate(activeTabId, ctx.settings.get().behavior.homePage);
      return;

    case 'view.zoomIn':
      if (activeTabId) ctx.tabs.adjustZoom(activeTabId, 0.5);
      return;
    case 'view.zoomOut':
      if (activeTabId) ctx.tabs.adjustZoom(activeTabId, -0.5);
      return;
    case 'view.zoomReset':
      if (activeTabId) ctx.tabs.setZoom(activeTabId, 0);
      return;
    case 'view.fullscreen':
      if (dandelionWindow) {
        ctx.windows.setFullScreen(
          dandelionWindow.id,
          !dandelionWindow.browserWindow.isFullScreen(),
        );
      }
      return;

    case 'window.new': {
      // Carry the current workspace over explicitly, as `window.newPrivate`
      // does. Left null, the new renderer's `initialState` falls back to the
      // first workspace, so a new window opened from any other space landed in
      // the wrong one.
      const created = ctx.openWindow();
      created.activeWorkspaceId = dandelionWindow?.activeWorkspaceId ?? null;
      return;
    }
    case 'window.newPrivate': {
      const privateProfile = ctx.profiles.ensurePrivate();
      const workspace = ctx.workspaces.ensureDefault(privateProfile.id);
      const created = ctx.openWindow();
      created.activeWorkspaceId = workspace.id;
      return;
    }
    case 'window.close':
      if (dandelionWindow) ctx.windows.close(dandelionWindow.id);
      return;
    case 'window.minimize':
      if (dandelionWindow) ctx.windows.minimize(dandelionWindow.id);
      return;

    case 'tools.devtools':
      if (activeTabId) ctx.tabs.toggleDevTools(activeTabId);
      return;
    case 'app.quit':
      app.quit();
      return;

    default:
      // UI-owned commands (address bar, palette, sidebar, find, settings, …).
      forwardToRenderer();
  }
}

function toggleFlag(ctx: AppContext, tabId: string | null, flag: 'pinned' | 'muted'): void {
  if (!tabId) return;
  const tab = ctx.tabs.get(tabId);
  if (!tab) return;
  if (flag === 'pinned') ctx.tabs.setPinned(tabId, !tab.pinned);
  else ctx.tabs.setMuted(tabId, !tab.muted);
}

function cycleTab(ctx: AppContext, window: DandelionWindow | null, direction: number): void {
  if (!window?.activeWorkspaceId) return;
  const tabs = ctx.tabs.listInWindow(window.id, window.activeWorkspaceId);
  if (tabs.length === 0) return;
  const currentIndex = tabs.findIndex((tab) => tab.id === window.activeTabId);
  const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
  const next = tabs[nextIndex];
  if (next) ctx.tabs.activate(next.id);
}

function selectTabByOrdinal(
  ctx: AppContext,
  window: DandelionWindow | null,
  ordinal: number,
): void {
  if (!window?.activeWorkspaceId) return;
  const tabs = ctx.tabs.listInWindow(window.id, window.activeWorkspaceId);
  const target = ordinal < 0 ? tabs[tabs.length - 1] : tabs[ordinal];
  if (target) ctx.tabs.activate(target.id);
}
