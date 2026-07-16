import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';
import { getCommand } from '@shared/constants';
import type { AppContext } from './app-context';
import { executeCommand } from './command-executor';

// Keys we must NOT bind as global menu accelerators, because web pages and text
// fields rely on them (e.g. Escape closes dialogs / exits fullscreen video).
const RESERVED_KEYS = new Set(['Escape']);

/**
 * Build the application menu. Because Electron routes menu accelerators to the
 * app even while a `WebContentsView` (tab) has key focus, this is how browser
 * shortcuts keep working over web content. The menu is rebuilt whenever the
 * user's keybindings change.
 */
export function buildApplicationMenu(ctx: AppContext): void {
  const commandItems: MenuItemConstructorOptions[] = ctx.settings
    .get()
    .shortcuts.filter(
      (binding) =>
        binding.enabled && getCommand(binding.action) && !RESERVED_KEYS.has(binding.keys),
    )
    .map((binding) => ({
      label: getCommand(binding.action)!.title,
      accelerator: binding.keys,
      click: () => {
        const focused = BrowserWindow.getFocusedWindow();
        const windowId = focused
          ? (ctx.windows.fromWebContents(focused.webContents)?.id ?? null)
          : null;
        executeCommand(ctx, binding.action, windowId);
      },
    }));

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? ([{ role: 'appMenu' }] satisfies MenuItemConstructorOptions[])
      : []),
    { role: 'editMenu' },
    { label: 'Commands', submenu: commandItems },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Toggle Interface DevTools',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
