import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TabLoadScheduler } from '@main/browser/tab-load-scheduler';
import type { TabLoadSchedulerDeps } from '@main/browser/tab-load-scheduler';

interface Harness {
  scheduler: TabLoadScheduler;
  /** Tab ids for which startLoad was called, in order. */
  started: string[];
  /** Tabs the scheduler should treat as on screen. Mutate between calls. */
  onScreen: Set<string>;
  /** Tabs whose startLoad should report "no slot used" (internal/already loaded). */
  noSlot: Set<string>;
  warnings: string[];
}

const TIMEOUT = 12_000;

function makeScheduler(maxConcurrent = 3): Harness {
  const started: string[] = [];
  const onScreen = new Set<string>();
  const noSlot = new Set<string>();
  const warnings: string[] = [];

  const deps: TabLoadSchedulerDeps = {
    maxConcurrent,
    slotTimeoutMs: TIMEOUT,
    isOnScreen: (tabId) => onScreen.has(tabId),
    startLoad: (tabId) => {
      started.push(tabId);
      return !noSlot.has(tabId);
    },
    logger: {
      warn: (message: string) => warnings.push(message),
    } as unknown as TabLoadSchedulerDeps['logger'],
  };

  return { scheduler: new TabLoadScheduler(deps), started, onScreen, noSlot, warnings };
}

/** Request a set of tabs, each treated as on screen at the moment it is asked for. */
function requestOnScreen(harness: Harness, ...tabIds: string[]): void {
  for (const tabId of tabIds) {
    harness.onScreen.add(tabId);
    harness.scheduler.request(tabId);
  }
}

describe('TabLoadScheduler', () => {
  it('loads immediately while under the concurrency cap', () => {
    const h = makeScheduler(3);
    requestOnScreen(h, 'a', 'b', 'c');
    expect(h.started).toEqual(['a', 'b', 'c']);
    expect(h.scheduler.activeLoadCount).toBe(3);
  });

  it('queues loads beyond the cap and admits them as slots free', () => {
    const h = makeScheduler(2);
    requestOnScreen(h, 'a', 'b', 'c', 'd');
    // Only two start; c and d wait.
    expect(h.started).toEqual(['a', 'b']);

    h.scheduler.release('a');
    expect(h.started).toEqual(['a', 'b', 'c']);

    h.scheduler.release('b');
    expect(h.started).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves a superseded tab unloaded and skips to the next on-screen one', () => {
    const h = makeScheduler(1);
    requestOnScreen(h, 'a'); // loads, holds the only slot
    // b and c queue while off screen (superseded during a burst); d stays on screen.
    h.scheduler.request('b');
    h.scheduler.request('c');
    requestOnScreen(h, 'd');
    expect(h.started).toEqual(['a']);

    h.scheduler.release('a');
    // b and c were not on screen, so they are dropped; d loads.
    expect(h.started).toEqual(['a', 'd']);
    expect(h.scheduler.activeLoadCount).toBe(1);
  });

  it('drops a queued tab when it is released before its turn', () => {
    const h = makeScheduler(1);
    requestOnScreen(h, 'a');
    requestOnScreen(h, 'b'); // queued behind a
    expect(h.started).toEqual(['a']);

    h.scheduler.release('b'); // b closed while waiting
    h.scheduler.release('a'); // a settles — nothing left to admit
    expect(h.started).toEqual(['a']);
    expect(h.scheduler.activeLoadCount).toBe(0);
  });

  it('ignores a repeat request for a tab already loading or queued', () => {
    const h = makeScheduler(1);
    requestOnScreen(h, 'a');
    h.scheduler.request('a'); // already inflight
    requestOnScreen(h, 'b');
    h.scheduler.request('b'); // already queued
    expect(h.started).toEqual(['a']);

    h.scheduler.release('a');
    expect(h.started).toEqual(['a', 'b']); // b admitted once, not twice
  });

  it('does not spend a slot on an internal or already-loaded tab', () => {
    const h = makeScheduler(2);
    h.noSlot.add('a');
    requestOnScreen(h, 'a', 'b', 'c');
    // a starts but takes no slot, so b and c both load too.
    expect(h.started).toEqual(['a', 'b', 'c']);
    expect(h.scheduler.activeLoadCount).toBe(2);
  });

  describe('slot watchdog', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('frees a slot for the next tab if a load never settles', () => {
      const h = makeScheduler(1);
      requestOnScreen(h, 'a'); // holds the slot and never settles
      requestOnScreen(h, 'b');
      expect(h.started).toEqual(['a']);

      vi.advanceTimersByTime(TIMEOUT);

      expect(h.started).toEqual(['a', 'b']);
      expect(h.warnings).toHaveLength(1);
    });

    it('does not fire the watchdog once a load has settled', () => {
      const h = makeScheduler(1);
      requestOnScreen(h, 'a');
      h.scheduler.release('a'); // settled normally

      vi.advanceTimersByTime(TIMEOUT * 2);
      expect(h.warnings).toEqual([]);
    });
  });
});
