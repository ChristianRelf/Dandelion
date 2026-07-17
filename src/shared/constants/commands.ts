import type { CommandDescriptor } from '../types/command';
import type { ShortcutBinding } from '../types/settings';

/**
 * The canonical command registry. Every user action that can be bound to a key
 * or invoked from the command palette is declared exactly once here. The main
 * process executes commands; the renderer dispatches them.
 */
const TAB_INDEX_COMMANDS: CommandDescriptor[] = Array.from({ length: 8 }, (_, i) => ({
  id: `tab.select.${i + 1}`,
  title: `Switch to Tab ${i + 1}`,
  category: 'tabs',
  icon: null,
  defaultKeys: `CmdOrCtrl+${i + 1}`,
  palette: false,
}));

export const COMMANDS: readonly CommandDescriptor[] = [
  // Navigation
  {
    id: 'navigation.back',
    title: 'Go Back',
    category: 'navigation',
    icon: 'arrow-left',
    defaultKeys: 'Alt+Left',
    palette: true,
  },
  {
    id: 'navigation.forward',
    title: 'Go Forward',
    category: 'navigation',
    icon: 'arrow-right',
    defaultKeys: 'Alt+Right',
    palette: true,
  },
  {
    id: 'navigation.reload',
    title: 'Reload Page',
    category: 'navigation',
    icon: 'rotate-cw',
    defaultKeys: 'CmdOrCtrl+R',
    palette: true,
  },
  {
    id: 'navigation.hardReload',
    title: 'Reload Ignoring Cache',
    category: 'navigation',
    icon: 'rotate-cw',
    defaultKeys: 'CmdOrCtrl+Shift+R',
    palette: true,
  },
  {
    id: 'navigation.stop',
    title: 'Stop Loading',
    category: 'navigation',
    icon: 'x',
    defaultKeys: 'Escape',
    palette: false,
  },
  {
    id: 'navigation.home',
    title: 'Go to Home Page',
    category: 'navigation',
    icon: 'house',
    defaultKeys: 'Alt+Home',
    palette: true,
  },
  {
    id: 'navigation.focusAddressBar',
    title: 'Focus Address Bar',
    category: 'navigation',
    icon: 'search',
    defaultKeys: 'CmdOrCtrl+L',
    palette: true,
    keywords: ['url', 'omnibox', 'location'],
  },

  // Tabs
  {
    id: 'tab.new',
    title: 'New Tab',
    category: 'tabs',
    icon: 'plus',
    defaultKeys: 'CmdOrCtrl+T',
    palette: true,
  },
  {
    id: 'tab.close',
    title: 'Close Tab',
    category: 'tabs',
    icon: 'x',
    defaultKeys: 'CmdOrCtrl+W',
    palette: true,
  },
  {
    id: 'tab.reopenClosed',
    title: 'Reopen Closed Tab',
    category: 'tabs',
    icon: 'rotate-ccw',
    defaultKeys: 'CmdOrCtrl+Shift+T',
    palette: true,
  },
  {
    id: 'tab.next',
    title: 'Next Tab',
    category: 'tabs',
    icon: 'chevron-right',
    defaultKeys: 'Control+Tab',
    palette: true,
  },
  {
    id: 'tab.previous',
    title: 'Previous Tab',
    category: 'tabs',
    icon: 'chevron-left',
    defaultKeys: 'Control+Shift+Tab',
    palette: true,
  },
  {
    id: 'tab.duplicate',
    title: 'Duplicate Tab',
    category: 'tabs',
    icon: 'copy',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'tab.pin',
    title: 'Pin / Unpin Tab',
    category: 'tabs',
    icon: 'pin',
    defaultKeys: 'CmdOrCtrl+Shift+P',
    palette: true,
  },
  {
    id: 'tab.mute',
    title: 'Mute / Unmute Tab',
    category: 'tabs',
    icon: 'volume-off',
    defaultKeys: 'CmdOrCtrl+Shift+M',
    palette: true,
  },
  {
    id: 'tab.sleep',
    title: 'Put Tab to Sleep',
    category: 'tabs',
    icon: 'moon',
    defaultKeys: null,
    palette: true,
    keywords: ['discard', 'suspend'],
  },
  {
    id: 'tab.moveToNewWindow',
    title: 'Move Tab to New Window',
    category: 'tabs',
    icon: 'external-link',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'tab.closeOthers',
    title: 'Close Other Tabs',
    category: 'tabs',
    icon: 'x',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'tab.closeToRight',
    title: 'Close Tabs to the Right',
    category: 'tabs',
    icon: 'x',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'tab.search',
    title: 'Search Tabs',
    category: 'tabs',
    icon: 'search',
    defaultKeys: 'CmdOrCtrl+Shift+A',
    palette: true,
  },
  ...TAB_INDEX_COMMANDS,
  {
    id: 'tab.select.last',
    title: 'Switch to Last Tab',
    category: 'tabs',
    icon: null,
    defaultKeys: 'CmdOrCtrl+9',
    palette: false,
  },

  // Tab groups
  {
    id: 'tabGroup.create',
    title: 'Group Selected Tabs',
    category: 'tabs',
    icon: 'folder',
    defaultKeys: 'CmdOrCtrl+G',
    palette: true,
  },
  {
    id: 'tabGroup.collapseAll',
    title: 'Collapse All Groups',
    category: 'tabs',
    icon: 'chevrons-down-up',
    defaultKeys: null,
    palette: true,
  },

  // View
  {
    id: 'view.toggleTabLayout',
    title: 'Toggle Vertical / Horizontal Tabs',
    category: 'view',
    icon: 'layout',
    defaultKeys: 'CmdOrCtrl+Shift+L',
    palette: true,
  },
  {
    id: 'view.toggleSidebar',
    title: 'Toggle Sidebar',
    category: 'view',
    icon: 'panel-left',
    defaultKeys: 'CmdOrCtrl+B',
    palette: true,
  },
  {
    id: 'view.splitView',
    title: 'Toggle Split View',
    category: 'view',
    icon: 'columns-2',
    defaultKeys: 'CmdOrCtrl+Shift+Backslash',
    palette: true,
  },
  {
    id: 'view.zoomIn',
    title: 'Zoom In',
    category: 'view',
    icon: 'zoom-in',
    defaultKeys: 'CmdOrCtrl+Plus',
    palette: true,
  },
  {
    id: 'view.zoomOut',
    title: 'Zoom Out',
    category: 'view',
    icon: 'zoom-out',
    defaultKeys: 'CmdOrCtrl+-',
    palette: true,
  },
  {
    id: 'view.zoomReset',
    title: 'Reset Zoom',
    category: 'view',
    icon: 'search',
    defaultKeys: 'CmdOrCtrl+0',
    palette: true,
  },
  {
    id: 'view.fullscreen',
    title: 'Toggle Full Screen',
    category: 'view',
    icon: 'maximize',
    defaultKeys: 'F11',
    palette: true,
  },
  {
    id: 'view.readerMode',
    title: 'Toggle Reader Mode',
    category: 'view',
    icon: 'book-open',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'view.findInPage',
    title: 'Find in Page',
    category: 'view',
    icon: 'search',
    defaultKeys: 'CmdOrCtrl+F',
    palette: true,
  },

  // Workspaces
  {
    id: 'workspace.next',
    title: 'Next Workspace',
    category: 'workspaces',
    icon: 'chevron-right',
    defaultKeys: 'CmdOrCtrl+Alt+Right',
    palette: true,
  },
  {
    id: 'workspace.previous',
    title: 'Previous Workspace',
    category: 'workspaces',
    icon: 'chevron-left',
    defaultKeys: 'CmdOrCtrl+Alt+Left',
    palette: true,
  },
  {
    id: 'workspace.create',
    title: 'New Workspace',
    category: 'workspaces',
    icon: 'plus',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'workspace.switcher',
    title: 'Switch Workspace…',
    category: 'workspaces',
    icon: 'layout-grid',
    defaultKeys: 'CmdOrCtrl+Alt+S',
    palette: true,
  },

  // Tools
  {
    id: 'tools.commandPalette',
    title: 'Open Command Palette',
    category: 'tools',
    icon: 'command',
    defaultKeys: 'CmdOrCtrl+K',
    palette: false,
    keywords: ['raycast', 'actions'],
  },
  {
    id: 'tools.downloads',
    title: 'Downloads',
    category: 'tools',
    icon: 'download',
    defaultKeys: 'CmdOrCtrl+Shift+J',
    palette: true,
  },
  {
    id: 'tools.history',
    title: 'History',
    category: 'tools',
    icon: 'history',
    defaultKeys: 'CmdOrCtrl+Y',
    palette: true,
  },
  {
    id: 'tools.bookmarks',
    title: 'Bookmarks Manager',
    category: 'tools',
    icon: 'bookmark',
    defaultKeys: 'CmdOrCtrl+Shift+O',
    palette: true,
  },
  {
    id: 'tools.bookmarkPage',
    title: 'Bookmark This Page',
    category: 'tools',
    icon: 'bookmark-plus',
    defaultKeys: 'CmdOrCtrl+D',
    palette: true,
  },
  {
    id: 'tools.settings',
    title: 'Settings',
    category: 'tools',
    icon: 'settings',
    defaultKeys: 'CmdOrCtrl+,',
    palette: true,
  },
  {
    id: 'tools.passwords',
    title: 'Passwords',
    category: 'tools',
    icon: 'key-round',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'tools.sessions',
    title: 'Saved Sessions…',
    category: 'tools',
    icon: 'layers',
    defaultKeys: null,
    palette: true,
    keywords: ['restore', 'session', 'reopen'],
  },
  {
    id: 'tools.saveSession',
    title: 'Save Current Session',
    category: 'tools',
    icon: 'save',
    defaultKeys: null,
    palette: true,
  },
  {
    id: 'tools.devtools',
    title: 'Toggle Developer Tools',
    category: 'developer',
    icon: 'code',
    defaultKeys: 'CmdOrCtrl+Shift+I',
    palette: true,
  },
  {
    id: 'tools.viewSource',
    title: 'View Page Source',
    category: 'developer',
    icon: 'file-code',
    defaultKeys: 'CmdOrCtrl+U',
    palette: true,
  },
  {
    id: 'tools.aiSidebar',
    title: 'Toggle AI Assistant',
    category: 'tools',
    icon: 'sparkles',
    defaultKeys: 'CmdOrCtrl+/',
    palette: true,
  },
  {
    id: 'tools.print',
    title: 'Print…',
    category: 'tools',
    icon: 'printer',
    defaultKeys: 'CmdOrCtrl+P',
    palette: true,
  },
  {
    id: 'tools.clearBrowsingData',
    title: 'Clear Browsing Data…',
    category: 'tools',
    icon: 'trash-2',
    defaultKeys: 'CmdOrCtrl+Shift+Delete',
    palette: true,
  },

  // Window
  {
    id: 'window.new',
    title: 'New Window',
    category: 'window',
    icon: 'app-window',
    defaultKeys: 'CmdOrCtrl+N',
    palette: true,
  },
  {
    id: 'window.newPrivate',
    title: 'New Private Window',
    category: 'window',
    icon: 'venetian-mask',
    defaultKeys: 'CmdOrCtrl+Shift+N',
    palette: true,
  },
  {
    id: 'window.close',
    title: 'Close Window',
    category: 'window',
    icon: 'x',
    defaultKeys: 'CmdOrCtrl+Shift+W',
    palette: true,
  },
  {
    id: 'window.minimize',
    title: 'Minimize Window',
    category: 'window',
    icon: 'minus',
    defaultKeys: 'CmdOrCtrl+M',
    palette: false,
  },

  // App
  {
    id: 'app.quit',
    title: 'Quit Dandelion',
    category: 'app',
    icon: 'power',
    defaultKeys: 'CmdOrCtrl+Q',
    palette: true,
  },
  {
    id: 'app.about',
    title: 'About Dandelion',
    category: 'app',
    icon: 'info',
    defaultKeys: null,
    palette: true,
  },
] as const;

const COMMAND_INDEX = new Map(COMMANDS.map((command) => [command.id, command]));

export function getCommand(id: string): CommandDescriptor | undefined {
  return COMMAND_INDEX.get(id);
}

const MODIFIER_GLYPHS: Record<string, string> = {
  CmdOrCtrl: '⌘',
  Shift: '⇧',
  Alt: '⌥',
};

/**
 * A command's default binding rendered as glyphs, derived from the registry
 * above so a label cannot drift from the key it advertises — which is how the
 * title bar came to claim `⌃B` for a `CmdOrCtrl+B` binding.
 *
 * `separator` belongs to the caller rather than to this function: tooltips run
 * the glyphs together (`⌘⇧J`), the palette's `Kbd` chips space them (`⌘ ⇧ J`).
 */
export function acceleratorLabel(commandId: string, separator = ' '): string | null {
  const keys = getCommand(commandId)?.defaultKeys;
  if (!keys) return null;
  return keys
    .split('+')
    .map((part) => MODIFIER_GLYPHS[part] ?? part)
    .join(separator);
}

/** Default keybindings derived from the command registry. */
export const DEFAULT_SHORTCUTS: readonly ShortcutBinding[] = COMMANDS.filter(
  (command): command is CommandDescriptor & { defaultKeys: string } => command.defaultKeys !== null,
).map((command) => ({ action: command.id, keys: command.defaultKeys, enabled: true }));
