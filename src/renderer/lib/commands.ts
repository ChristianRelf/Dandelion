import { DEFAULT_ACCENT, INTERNAL_PAGES } from '@shared/constants';
import { trpc } from './trpc/client';
import { nextGroupColor } from './tab-colors';
import { openUrl } from './navigation';
import { selectOrderedTabs, selectSplitActive, useBrowserStore } from '../stores/browser.store';
import { useUiStore } from '../stores/ui.store';
import { useReaderStore } from '../stores/reader.store';
import { toast } from '../stores/toast.store';

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
  'tools.print',
  'tools.screenshot',
  'tools.clearBrowsingData',
  'tab.search',
  'tabGroup.create',
  'tabGroup.collapseAll',
  'tools.sessions',
  'tools.saveSession',
  'workspace.next',
  'workspace.previous',
  'workspace.create',
  'workspace.switcher',
]);

async function createWorkspace(): Promise<void> {
  const { profile } = useBrowserStore.getState();
  if (!profile) return;
  const workspace = await trpc.workspaces.create.mutate({
    profileId: profile.id,
    name: 'New Space',
    icon: 'sparkles',
    accentColor: DEFAULT_ACCENT,
  });
  await useBrowserStore.getState().refreshWorkspaces();
  await useBrowserStore.getState().switchWorkspace(workspace.id);
}

function groupActiveTab(): void {
  const { activeTabId, activeWorkspaceId, tabs, groups } = useBrowserStore.getState();
  if (!activeTabId || !activeWorkspaceId) return;
  void trpc.tabs.createGroup.mutate({
    workspaceId: activeWorkspaceId,
    name: 'New group',
    color: nextGroupColor(Object.keys(groups).length),
    tabIds: [activeTabId],
  });
  void tabs; // (kept for clarity: the active tab is the sole initial member)
}

function collapseAllGroups(): void {
  for (const group of Object.values(useBrowserStore.getState().groups)) {
    if (!group.collapsed) void trpc.tabs.updateGroup.mutate({ groupId: group.id, collapsed: true });
  }
}

/**
 * Print the active tab. Main owns the print dialog because only it holds the
 * page's `webContents`; it reports back whether the tab had a view at all, so
 * `⌘P` on one of the browser's own pages says so rather than doing nothing.
 */
async function printActiveTab(): Promise<void> {
  const { activeTabId } = useBrowserStore.getState();
  if (!activeTabId) return;
  const printed = await trpc.tabs.print.mutate({ tabId: activeTabId });
  if (!printed) toast.show('This page can’t be printed');
}

async function screenshotActiveTab(): Promise<void> {
  const { activeTabId } = useBrowserStore.getState();
  if (!activeTabId) return;
  const { filename } = await trpc.tabs.screenshot.mutate({ tabId: activeTabId });
  toast.success(`Saved ${filename} to Downloads`);
}

function viewSource(): void {
  const { activeTabId, tabs } = useBrowserStore.getState();
  const tab = activeTabId ? tabs[activeTabId] : null;
  if (tab && tab.url && !tab.url.startsWith('view-source:')) {
    void trpc.tabs.create.mutate({
      workspaceId: tab.workspaceId,
      url: `view-source:${tab.url}`,
      active: true,
    });
  }
}

/**
 * Split the active tab against its nearest sibling, or exit an active split.
 * Main owns the split, so there is nothing to update locally — the resulting
 * `window:state` event carries the new arrangement back to the store.
 */
function toggleSplitView(): void {
  const browser = useBrowserStore.getState();
  if (selectSplitActive(browser)) {
    void trpc.tabs.clearSplit.mutate();
    return;
  }
  const active = browser.activeTabId;
  const other = selectOrderedTabs(browser).find((tab) => tab.id !== active);
  if (!active || !other) {
    toast.show('Split view needs a second tab');
    return;
  }
  void trpc.tabs.setSplit.mutate({
    windowId: browser.windowId,
    tabIds: [active, other.id],
    orientation: 'vertical',
  });
}

/** Navigate to one of the browser's own pages — see `INTERNAL_PAGES`. */
export function openInternalPage(url: string): Promise<void> {
  return openUrl(url);
}

/**
 * Open one of the browser's own pages in a tab of its own rather than replacing
 * whatever the active tab is showing. Settings and the like are destinations you
 * return to, not steps in browsing, so a second click focuses the existing tab
 * instead of opening a duplicate.
 */
export async function openInternalPageInOwnTab(url: string): Promise<void> {
  const { tabs, activeWorkspaceId } = useBrowserStore.getState();
  if (!activeWorkspaceId) return;
  const existing = Object.values(tabs).find(
    (tab) => tab.workspaceId === activeWorkspaceId && tab.url === url,
  );
  if (existing) {
    await trpc.tabs.activate.mutate({ tabId: existing.id });
    return;
  }
  await trpc.tabs.create.mutate({ workspaceId: activeWorkspaceId, url, active: true });
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
      void openInternalPageInOwnTab(INTERNAL_PAGES.settings);
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
    case 'tools.viewSource':
      viewSource();
      return;
    case 'tools.print':
      void printActiveTab().catch(() => toast.error('Could not print this page'));
      return;
    case 'tools.screenshot':
      void screenshotActiveTab().catch((error) =>
        toast.error('Couldn’t save screenshot', {
          description: error instanceof Error ? error.message : undefined,
        }),
      );
      return;
    case 'tools.clearBrowsingData':
      void openInternalPageInOwnTab(INTERNAL_PAGES.settings);
      return;
    case 'tab.search':
      ui.openTabSwitcher();
      return;
    case 'tools.sessions':
      ui.openSessions();
      return;
    case 'tools.saveSession':
      void trpc.sessions.saveCurrent
        .mutate()
        .then((saved) => {
          if (saved) toast.success('Session saved');
          else toast.error('Nothing open to save');
        })
        .catch(() => toast.error('Could not save session'));
      return;
    case 'tabGroup.create':
      groupActiveTab();
      return;
    case 'tabGroup.collapseAll':
      collapseAllGroups();
      return;
    case 'view.splitView':
      toggleSplitView();
      return;
    case 'view.readerMode': {
      const { activeTabId } = useBrowserStore.getState();
      if (activeTabId) useReaderStore.getState().toggle(activeTabId);
      return;
    }
    case 'workspace.next':
      void cycleWorkspace(1);
      return;
    case 'workspace.previous':
      void cycleWorkspace(-1);
      return;
    case 'workspace.create':
      void createWorkspace();
      return;
    case 'workspace.switcher':
      // Seeded, so the palette opens on the Workspaces group rather than the
      // full command list. Previously this opened the palette and nothing else,
      // and the palette has no workspace list to open onto.
      ui.openPalette('workspace');
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
