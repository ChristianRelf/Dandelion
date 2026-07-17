import { WebContentsView, type WebContents } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import type { PopupAnchor, PopupKind, PopupSize } from '@shared/types';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';
import type { WindowManager } from './window-manager';

/** Gap between the trigger and the popover, matching the Radix `sideOffset`. */
const ANCHOR_GAP = 6;

/** Kept clear of the window edges, so a popover never touches the frame. */
const EDGE_MARGIN = 8;

/**
 * Room for the popover's drop shadow. The surface is a rectangle and the shadow
 * is drawn inside it, so without this the shadow would be clipped at the edge.
 * It is transparent, and it does swallow pointer events in that ring — the cost
 * of a shadow that exists at all.
 */
const SHADOW_PAD = 20;

/** Until the popup reports its real size, so nothing flashes at the wrong size. */
const INITIAL_SIZE: PopupSize = { width: 1, height: 1 };

interface Surface {
  view: WebContentsView;
  kind: PopupKind | null;
  anchor: PopupAnchor | null;
  loaded: boolean;
}

/**
 * Hosts toolbar popovers in a surface that floats **above** the page.
 *
 * Tab content is a native `WebContentsView` added on top of the chrome in the
 * content region, so a popover the chrome renders — anchored to a toolbar button
 * and dropping down into that region — is painted over by the page and swallows
 * no clicks of its own. Downloads, the update chip and zoom were all unreachable
 * on any real site, and worked only on internal pages, where `activate()`
 * destroys the view and leaves nothing on top.
 *
 * The fix is z-order, not visibility. Child views stack in insertion order, and
 * tab views are added at index 0, so a surface appended after them sits above
 * every one. Hiding the page instead — the treatment the omnibox and palette get
 * — would have been a few lines, but it defeats zoom (you cannot watch the page
 * resize) and yanks the page away when a download auto-opens the bubble.
 *
 * One surface per window, created on first use and kept: it is a whole renderer,
 * and paying that boot on every click would be worse than the memory. It is
 * sized to the popover so clicks outside it still reach the page, and closes when
 * its own web contents lose focus — clicking the page or the chrome focuses them,
 * which blurs the surface.
 */
export class PopupHost {
  private readonly surfaces = new Map<string, Surface>();

  constructor(
    private readonly windows: WindowManager,
    private readonly events: EventBus,
    private readonly logger: Logger,
  ) {
    this.windows.onWindowClosed((windowId) => this.destroy(windowId));
  }

  /**
   * The window a popup surface belongs to. The IPC host resolves a caller's
   * window through `WindowManager.fromWebContents`, which only knows about
   * `BrowserWindow`s — a surface is a view, so it would otherwise arrive with no
   * window and be rejected by every window-scoped proc it needs.
   */
  ownerOf(webContents: WebContents): string | null {
    for (const [windowId, surface] of this.surfaces) {
      if (surface.view.webContents === webContents) return windowId;
    }
    return null;
  }

  /**
   * Every live surface. The event bridge fans out over
   * `BrowserWindow.getAllWindows()`, which does not reach a child view — so
   * without this a popup would never hear that the state it renders had moved.
   */
  surfaceContents(): WebContents[] {
    return [...this.surfaces.values()].map((surface) => surface.view.webContents);
  }

  /** Show `kind` anchored under `anchor`, or move an open surface to it. */
  open(windowId: string, kind: PopupKind, anchor: PopupAnchor): void {
    const surface = this.ensure(windowId);
    if (!surface) return;

    surface.kind = kind;
    surface.anchor = anchor;
    // The very first click builds the surface and asks for a popover in the same
    // breath, so there is nothing listening yet. `did-finish-load` replays the
    // request rather than dropping the click that paid for the boot. Either way
    // the surface stays hidden until the popup reports a size, so nothing
    // flashes at a size nothing chose.
    if (surface.loaded) this.announce(windowId, kind);
  }

  close(windowId: string): void {
    const surface = this.surfaces.get(windowId);
    if (!surface || !surface.kind) return;
    surface.kind = null;
    surface.anchor = null;
    surface.view.setVisible(false);
    this.announce(windowId, null);
  }

  /**
   * Addressed to one window. Every event is broadcast to every surface, and a
   * second window's popup must not follow this one's.
   */
  private announce(windowId: string, kind: PopupKind | null): void {
    this.events.emit({ type: 'popup:show', windowId, kind });
  }

  /** The popup measured itself; place and reveal it. */
  resize(windowId: string, size: PopupSize): void {
    const surface = this.surfaces.get(windowId);
    if (!surface?.anchor || !surface.kind) return;

    const bounds = this.place(windowId, surface.anchor, size);
    if (!bounds) return;
    surface.view.setBounds(bounds);
    surface.view.setVisible(true);
    surface.view.webContents.focus();
  }

  /**
   * Right-aligned under the trigger, clamped inside the window. Every toolbar
   * popover is `align="end"`, and the toolbar lives at the top, so this is the
   * one arrangement — flipping above would put it outside the window.
   */
  private place(
    windowId: string,
    anchor: PopupAnchor,
    size: PopupSize,
  ): { x: number; y: number; width: number; height: number } | null {
    const dandelionWindow = this.windows.get(windowId);
    if (!dandelionWindow) return null;
    const { width: windowWidth, height: windowHeight } =
      dandelionWindow.browserWindow.getContentBounds();

    const width = size.width + SHADOW_PAD * 2;
    const height = size.height + SHADOW_PAD * 2;

    const desiredRight = anchor.x + anchor.width;
    let x = desiredRight - size.width - SHADOW_PAD;
    let y = anchor.y + anchor.height + ANCHOR_GAP - SHADOW_PAD;

    x = Math.max(EDGE_MARGIN - SHADOW_PAD, Math.min(x, windowWidth - width + SHADOW_PAD));
    y = Math.max(EDGE_MARGIN - SHADOW_PAD, Math.min(y, windowHeight - height + SHADOW_PAD));

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  private ensure(windowId: string): Surface | null {
    const existing = this.surfaces.get(windowId);
    if (existing) return existing;

    const dandelionWindow = this.windows.get(windowId);
    if (!dandelionWindow) return null;

    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        transparent: true,
        // The surface renders the chrome's own UI and talks to the same tRPC
        // host, so it needs the window it belongs to — the preload reads this.
        additionalArguments: [`--dandelion-window-id=${windowId}`],
      },
    });
    // Nothing behind the popover's own card should paint: the rest of the
    // surface is shadow and margin, and the page has to show through it.
    view.setBackgroundColor('#00000000');
    view.setVisible(false);
    view.setBounds({ x: 0, y: 0, ...INITIAL_SIZE });

    // No index: child views stack in insertion order and tab views are added at
    // 0, so appending puts this above every one of them. That is the entire fix.
    dandelionWindow.browserWindow.contentView.addChildView(view);

    const surface: Surface = { view, kind: null, anchor: null, loaded: false };
    this.surfaces.set(windowId, surface);

    view.webContents.on('blur', () => this.close(windowId));
    view.webContents.once('did-finish-load', () => {
      surface.loaded = true;
      // Replay the click that built this surface: `open` had nothing to tell.
      if (surface.kind) this.announce(windowId, surface.kind);
    });
    void this.load(view);

    return surface;
  }

  private async load(view: WebContentsView): Promise<void> {
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    try {
      if (is.dev && devUrl) {
        await view.webContents.loadURL(`${devUrl}?popup=1`);
      } else {
        await view.webContents.loadFile(join(__dirname, '../renderer/index.html'), {
          query: { popup: '1' },
        });
      }
    } catch (error) {
      this.logger.warn('failed to load the popup surface', error);
    }
  }

  private destroy(windowId: string): void {
    const surface = this.surfaces.get(windowId);
    if (!surface) return;
    this.surfaces.delete(windowId);
    const wc = surface.view.webContents as unknown as {
      destroy?: () => void;
      isDestroyed?: () => boolean;
    };
    try {
      if (wc.isDestroyed && !wc.isDestroyed() && wc.destroy) wc.destroy();
    } catch {
      /* the window took it with it */
    }
  }
}
