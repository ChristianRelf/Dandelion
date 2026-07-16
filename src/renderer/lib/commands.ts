import { DEFAULT_ACCENT, INTERNAL_PAGES } from '@shared/constants';
import { trpc } from './trpc/client';
import { nextGroupColor } from './tab-colors';
import { useBrowserStore } from '../stores/browser.store';
import { useUiStore } from '../stores/ui.store';

/** Commands the renderer handles locally (everything else runs in main). */
const UI_COMMANDS = new Set([
  'navigation.focusAddressBar',
  'tools.commandPalette',
  'view.findInPage',
  'view.toggleSidebar',
  'view.toggleTabLayout',
  'view.splitView',
  'view.readerMode',
  'tools.aiSidebar',
  'tools.settings',
  'tools.history',
  'tools.downloads',
  'tools.bookmarks',
  'tools.passwords',
  'tools.bookmarkPage',
  'tools.viewSource',
  'tools.clearBrowsingData',
  'tab.search',
  'tabGroup.create',
  'tabGroup.collapseAll',
  'workspace.next',
  'workspace.previous',
  'workspace.create',
  'workspace.switcher',
]);

export async function openInternalPage(url: string): Promise<void> {
  const { activeTabId, activeWorkspaceId } = useBrowserStore.getState();
  if (activeTabId) {
    await trpc.tabs.navigate.mutate({ tabId: activeTabId, url });
  } else if (activeWorkspaceId) {
    await trpc.tabs.create.mutate({ workspaceId: activeWorkspaceId, url, active: true });
  }
}

async function toggleBookmarkActive(): Promise<void> {
  const { activeTabId, tabs, profile, activeWorkspaceId } = useBrowserStore.getState();
  const tab = activeTabId ? tabs[activeTabId] : null;
  if (!tab || !profile) return;
  await trpc.bookmarks.toggle.mutate({
    profileId: profile.id,
    url: tab.url,
    title: tab.title,
    workspaceId: activeWorkspaceId,
  });
}

async function cycleWorkspace(direction: number): Promise<void> {
  const { workspaces, activeWorkspaceId, switchWorkspace } = useBrowserStore.getState();
  if (workspaces.length === 0) return;
  const index = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
  const next = workspaces[(index + direction + workspaces.length) % workspaces.length];
  if (next) await switchWorkspace(next.id);
}

function toggleTabLayout(): void {
  const settings = useBrowserStore.getState().settings;
  const next = settings?.behavior.defaultTabLayout === 'vertical' ? 'horizontal' : 'vertical';
  void useBrowserStore.getState().patchSettings({ behavior: { defaultTabLayout: next } });
}

/** Handle a UI-owned command in the renderer. */
export function handleUiCommand(commandId: string): void {
  const ui = useUiStore.getState();
  const browser = useBrowserStore.getState();

  switch (commandId) {
    case 'navigation.focusAddressBar': {
      const url = browser.activeTabId ? (browser.tabs[browser.activeTabId]?.url ?? '') : '';
      ui.openOmnibox(url.startsWith('dandelion://') ? '' : url);
      return;
    }
    case 'tools.commandPalette':
      ui.togglePalette();
      return;
    case 'view.findInPage':
      ui.toggleFind();
      return;
    case 'view.toggleSidebar':
      ui.toggleSidebar();
      return;
    case 'view.toggleTabLayout':
      toggleTabLayout();
      return;
    case 'tools.aiSidebar':
      ui.toggleAiSidebar();
      return;
    case 'tools.settings':
      void openInternalPage(INTERNAL_PAGES.settings);
      return;
    case 'tools.history':
      void openInternalPage(INTERNAL_PAGES.history);
      return;
    case 'tools.downloads':
      void openInternalPage(INTERNAL_PAGES.downloads);
      return;
    case 'tools.bookmarks':
      void openInternalPage(INTERNAL_PAGES.bookmarks);
      return;
    case 'tools.passwords':
      void openInternalPage(INTERNAL_PAGES.passwords);
      return;
    case 'tools.bookmarkPage':
      void toggleBookmarkActive();
      return;
    case 'workspace.next':
      void cycleWorkspace(1);
      return;
    case 'workspace.previous':
      void cycleWorkspace(-1);
      return;
    case 'workspace.switcher':
      ui.openPalette();
      return;
    default:
      return;
  }
}

/** Dispatch a command from the UI (palette, buttons). */
export function dispatchCommand(commandId: string): void {
  if (UI_COMMANDS.has(commandId)) {
    handleUiCommand(commandId);
    return;
  }
  void trpc.app.runCommand.mutate({ commandId });
}
