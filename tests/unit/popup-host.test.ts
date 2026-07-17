import { describe, expect, it, vi } from 'vitest';

// PopupHost imports WebContentsView at module scope. Nothing here creates a
// surface: every test drives placement, which needs only the window's bounds.
vi.mock('electron', () => ({ WebContentsView: class {}, WebContents: class {} }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }));

const { PopupHost } = await import('@main/browser/popup-host');
import type { BrowserEvent, PopupAnchor } from '@shared/types';
import type { EventBus } from '@main/core/event-bus';
import type { Logger } from '@main/core/logger';
import type { WindowManager } from '@main/browser/window-manager';

const WINDOW = { width: 1200, height: 800 };
const SHADOW_PAD = 20;

/** The surface a `resize` would place, without building a real view. */
function place(anchor: PopupAnchor, size: { width: number; height: number }) {
  const emitted: BrowserEvent[] = [];
  let bounds: { x: number; y: number; width: number; height: number } | null = null;

  const windows = {
    get: () => ({
      browserWindow: { getContentBounds: () => ({ x: 0, y: 0, ...WINDOW }) },
    }),
    onWindowClosed: () => {},
  } as unknown as WindowManager;

  const host = new PopupHost(
    windows,
    { emit: (event: BrowserEvent) => emitted.push(event) } as unknown as EventBus,
    { info: () => {}, warn: () => {}, debug: () => {} } as unknown as Logger,
  );

  // Stand in for the surface `ensure()` would build; `resize` only needs its
  // recorded anchor and something to size.
  const view = {
    setBounds: (next: typeof bounds) => {
      bounds = next;
    },
    setVisible: () => {},
    webContents: { focus: () => {} },
  };
  (host as unknown as { surfaces: Map<string, unknown> }).surfaces.set('window_1', {
    view,
    kind: 'downloads',
    anchor,
    loaded: true,
  });

  host.resize('window_1', size);
  return bounds;
}

describe('PopupHost placement', () => {
  // Every toolbar popover is `align="end"`: its right edge meets the trigger's.
  it('right-aligns the card under its trigger', () => {
    const bounds = place({ x: 1100, y: 40, width: 30, height: 30 }, { width: 340, height: 200 });

    // The card sits inside the surface, inset by the shadow margin.
    const cardRight = bounds!.x + SHADOW_PAD + 340;
    expect(cardRight).toBe(1130); // the trigger's right edge
    // And below it, by the anchor gap.
    expect(bounds!.y + SHADOW_PAD).toBe(76);
  });

  it('pads the surface for the shadow on every side', () => {
    const bounds = place({ x: 600, y: 40, width: 30, height: 30 }, { width: 340, height: 200 });
    expect(bounds!.width).toBe(340 + SHADOW_PAD * 2);
    expect(bounds!.height).toBe(200 + SHADOW_PAD * 2);
  });

  // A trigger near the left edge would otherwise push a wide card off-window,
  // where it cannot be seen or clicked.
  it('keeps a wide card inside the window rather than off its left edge', () => {
    const bounds = place({ x: 8, y: 40, width: 30, height: 30 }, { width: 340, height: 200 });
    expect(bounds!.x + SHADOW_PAD).toBeGreaterThanOrEqual(0);
  });

  it('keeps a tall card inside the window rather than off its bottom', () => {
    const bounds = place({ x: 1100, y: 40, width: 30, height: 30 }, { width: 340, height: 900 });
    expect(bounds!.y + SHADOW_PAD).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeLessThanOrEqual(WINDOW.height);
  });

  it('rounds to whole pixels, which is what setBounds takes', () => {
    const bounds = place(
      { x: 1100.4, y: 40.6, width: 30, height: 30 },
      { width: 340, height: 200 },
    );
    for (const value of Object.values(bounds!)) expect(Number.isInteger(value)).toBe(true);
  });
});
