import type { BrowserWindow, WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';

import { broadcastEvent } from '@main/ipc/ipc-host';
import type { BrowserEvent } from '@shared/types';

/** The event whose emission during window teardown surfaced the crash. */
const EVENT = { type: 'popup:show', windowId: 'window_1', kind: null } as unknown as BrowserEvent;

function fakeContents(destroyed: boolean) {
  return { isDestroyed: () => destroyed, send: vi.fn() };
}

/**
 * A window that, like a real one, throws when its `webContents` is read after the
 * window itself is destroyed — so the test proves the destroyed-window guard runs
 * *before* the property is touched.
 */
function fakeWindow(windowDestroyed: boolean, contentsDestroyed: boolean) {
  const contents = fakeContents(contentsDestroyed);
  return {
    contents,
    isDestroyed: () => windowDestroyed,
    get webContents() {
      if (windowDestroyed) throw new Error('Object has been destroyed');
      return contents;
    },
  };
}

const asWindow = (w: ReturnType<typeof fakeWindow>): BrowserWindow => w as unknown as BrowserWindow;
const asContents = (c: ReturnType<typeof fakeContents>): WebContents => c as unknown as WebContents;

describe('broadcastEvent', () => {
  it('delivers to a live window and a live surface', () => {
    const window = fakeWindow(false, false);
    const surface = fakeContents(false);

    broadcastEvent(EVENT, [asWindow(window)], [asContents(surface)]);

    expect(window.contents.send).toHaveBeenCalledWith(expect.anything(), EVENT);
    expect(surface.send).toHaveBeenCalledWith(expect.anything(), EVENT);
  });

  // The crash: a closing window reports `isDestroyed()` false for a beat after its
  // webContents is gone. Sending to it must be skipped, never thrown.
  it('does not send to — or crash on — a window whose webContents is destroyed', () => {
    const window = fakeWindow(false, true);

    expect(() => broadcastEvent(EVENT, [asWindow(window)], [])).not.toThrow();
    expect(window.contents.send).not.toHaveBeenCalled();
  });

  it('skips a fully destroyed window without reading its webContents', () => {
    const window = fakeWindow(true, false);

    expect(() => broadcastEvent(EVENT, [asWindow(window)], [])).not.toThrow();
    expect(window.contents.send).not.toHaveBeenCalled();
  });

  it('skips a destroyed popup surface', () => {
    const surface = fakeContents(true);

    broadcastEvent(EVENT, [], [asContents(surface)]);

    expect(surface.send).not.toHaveBeenCalled();
  });

  it('still delivers to the good targets when one is destroyed', () => {
    const good = fakeWindow(false, false);
    const bad = fakeWindow(false, true);

    broadcastEvent(EVENT, [asWindow(bad), asWindow(good)], []);

    expect(good.contents.send).toHaveBeenCalledTimes(1);
  });

  // The teardown race the guard cannot catch: `isDestroyed()` returns false, but
  // the webContents dies before `send`, which throws. It must not escape.
  it('survives a send that throws even though isDestroyed() is false', () => {
    const racing = {
      isDestroyed: () => false,
      send: vi.fn(() => {
        throw new Error('Object has been destroyed');
      }),
    };
    const good = fakeContents(false);

    expect(() => broadcastEvent(EVENT, [], [asContents(racing), asContents(good)])).not.toThrow();
    // And a later target still receives it.
    expect(good.send).toHaveBeenCalledTimes(1);
  });
});
