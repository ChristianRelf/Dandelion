import { join } from 'node:path';
import { BrowserWindow, shell, type WebContents } from 'electron';
import { is } from '@electron-toolkit/utils';
import type { WindowBounds } from '@shared/types';
import { APP_ID, WINDOW_DEFAULTS } from '@shared/constants';
import { createId, debounce } from '@shared/utils';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';
import type { SettingsService } from '../services/settings.service';
import type { KvRepository } from '../storage';
import { DandelionWindow } from './dandelion-window';

const BOUNDS_KEY = 'window.lastBounds';

/**
 * Creates and tracks chrome windows. Each window is a frameless BrowserWindow
 * rendering the React UI, with tab content mounted as child WebContentsViews by
 * the TabManager. Bounds are persisted and window state changes are broadcast.
 */
export class WindowManager {
  private readonly windows = new Map<string, DandelionWindow>();
  private readonly closeListeners = new Set<(windowId: string) => void>();

  constructor(
    private readonly settings: SettingsService,
    private readonly events: EventBus,
    private readonly kv: KvRepository,
    private readonly logger: Logger,
  ) {}

  createWindow(): DandelionWindow {
    const id = createId('win');
    const saved = this.kv.get<WindowBounds | null>(BOUNDS_KEY, null);
    const isMac = process.platform === 'darwin';

    const browserWindow = new BrowserWindow({
      width: saved?.width ?? WINDOW_DEFAULTS.width,
      height: saved?.height ?? WINDOW_DEFAULTS.height,
      x: saved?.x,
      y: saved?.y,
      minWidth: WINDOW_DEFAULTS.minWidth,
      minHeight: WINDOW_DEFAULTS.minHeight,
      show: false,
      backgroundColor: '#0b0b0d',
      titleBarStyle: 'hidden',
      ...(isMac
        ? { trafficLightPosition: { x: 14, y: 13 } }
        : {
            titleBarOverlay: {
              color: '#0b0b0d',
              symbolColor: '#e5e5e5',
              height: WINDOW_DEFAULTS.titleBarHeight,
            },
          }),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true,
        additionalArguments: [`--dandelion-window-id=${id}`],
      },
    });

    const dandelionWindow = new DandelionWindow(
      id,
      browserWindow,
      this.settings.get().behavior.defaultTabLayout,
    );
    this.windows.set(id, dandelionWindow);

    browserWindow.once('ready-to-show', () => browserWindow.show());
    this.loadRenderer(browserWindow);
    this.wireEvents(dandelionWindow);

    if (process.platform === 'win32') {
      browserWindow.setAppDetails({ appId: APP_ID });
    }

    this.logger.info(`window created: ${id}`);
    return dandelionWindow;
  }

  get(id: string): DandelionWindow | null {
    return this.windows.get(id) ?? null;
  }

  all(): DandelionWindow[] {
    return [...this.windows.values()];
  }

  first(): DandelionWindow | null {
    return this.windows.values().next().value ?? null;
  }

  fromWebContents(webContents: WebContents): DandelionWindow | null {
    const browserWindow = BrowserWindow.fromWebContents(webContents);
    if (!browserWindow) return null;
    return this.all().find((window) => window.browserWindow === browserWindow) ?? null;
  }

  count(): number {
    return this.windows.size;
  }

  setContentBounds(windowId: string, bounds: WindowBounds): void {
    const window = this.windows.get(windowId);
    if (window) window.contentBounds = bounds;
  }

  broadcastState(window: DandelionWindow): void {
    if (window.browserWindow.isDestroyed()) return;
    this.events.emit({ type: 'window:state', window: window.toState() });
  }

  /* ---- Window controls ---- */

  minimize(windowId: string): void {
    this.windows.get(windowId)?.browserWindow.minimize();
  }

  toggleMaximize(windowId: string): void {
    const browserWindow = this.windows.get(windowId)?.browserWindow;
    if (!browserWindow) return;
    if (browserWindow.isMaximized()) browserWindow.unmaximize();
    else browserWindow.maximize();
  }

  close(windowId: string): void {
    this.windows.get(windowId)?.browserWindow.close();
  }

  setFullScreen(windowId: string, value: boolean): void {
    this.windows.get(windowId)?.browserWindow.setFullScreen(value);
  }

  onWindowClosed(listener: (windowId: string) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  private loadRenderer(browserWindow: BrowserWindow): void {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    if (is.dev && devUrl) {
      void browserWindow.loadURL(devUrl);
    } else {
      void browserWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
  }

  private wireEvents(window: DandelionWindow): void {
    const { browserWindow, id } = window;

    // The chrome window must never navigate itself to external content or open
    // OS windows — links are opened externally, tabs handle web content.
    browserWindow.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });
    browserWindow.webContents.on('will-navigate', (event, url) => {
      const devUrl = process.env['ELECTRON_RENDERER_URL'];
      const allowed = (devUrl && url.startsWith(devUrl)) || url.startsWith('file://');
      if (!allowed) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    });

    const persistBounds = debounce(() => {
      if (
        !browserWindow.isDestroyed() &&
        !browserWindow.isMinimized() &&
        !browserWindow.isMaximized()
      ) {
        this.kv.set(BOUNDS_KEY, browserWindow.getBounds());
      }
    }, 400);

    browserWindow.on('resize', () => {
      persistBounds();
      this.broadcastState(window);
    });
    browserWindow.on('move', persistBounds);
    const rebroadcast = (): void => this.broadcastState(window);
    browserWindow.on('maximize', rebroadcast);
    browserWindow.on('unmaximize', rebroadcast);
    browserWindow.on('enter-full-screen', rebroadcast);
    browserWindow.on('leave-full-screen', rebroadcast);
    browserWindow.on('focus', rebroadcast);
    browserWindow.on('blur', rebroadcast);
    browserWindow.on('closed', () => {
      this.windows.delete(id);
      for (const listener of this.closeListeners) listener(id);
    });
  }
}
