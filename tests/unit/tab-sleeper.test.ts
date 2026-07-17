import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TabSleeper } from '@main/browser/tab-sleeper';
import type { TabSleeperDeps } from '@main/browser/tab-sleeper';
import { INTERNAL_PAGES, LIMITS } from '@shared/constants';
import type { Tab } from '@shared/types';

const MINUTE = 60_000;

type TabOverrides = Partial<Tab> & { id: string };

function fakeTab({ id, ...rest }: TabOverrides): Tab {
  return {
    id,
    url: 'https://example.com',
    audible: false,
    asleep: false,
    pinned: false,
    ...rest,
  } as Tab;
}

interface Harness {
  sleeper: TabSleeper;
  slept: string[];
  tabs: Tab[];
  window: { activeTabId: string | null; splitTabIds: string[] };
  settings: {
    sleepEnabled: boolean;
    sleepAfterMinutes: number;
    sleepPinnedTabs: boolean;
  };
}

function makeSleeper(): Harness {
  const slept: string[] = [];
  const tabs: Tab[] = [];
  const window = { activeTabId: null as string | null, splitTabIds: [] as string[] };
  const settings = { sleepEnabled: true, sleepAfterMinutes: 30, sleepPinnedTabs: false };

  const deps = {
    tabs: {
      listAll: () => tabs,
      sleep: (tabId: string) => {
        slept.push(tabId);
        const tab = tabs.find((entry) => entry.id === tabId);
        // Mirror TabManager.sleep, so a slept tab is skipped on later sweeps.
        if (tab) tab.asleep = true;
      },
    },
    windows: { all: () => [window] },
    settings: { get: () => ({ tabs: settings }) },
    logger: { info: () => {} },
  } as unknown as TabSleeperDeps;

  return { sleeper: new TabSleeper(deps), slept, tabs, window, settings };
}

/** Off-screen tabs need one sweep to start their clock before any can expire. */
function windClock(harness: Harness): void {
  harness.sleeper.sweep();
}

describe('TabSleeper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('sleeps a tab left idle past the threshold', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    windClock(harness);
    vi.advanceTimersByTime(31 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual(['tab_1']);
  });

  it('leaves a tab alone until the threshold elapses', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    windClock(harness);
    vi.advanceTimersByTime(29 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('never sleeps the tab on screen', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1' }));
    harness.window.activeTabId = 'tab_1';

    windClock(harness);
    vi.advanceTimersByTime(10 * 60 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('never sleeps a split pane, which is still on screen', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1' }), fakeTab({ id: 'tab_2' }));
    harness.window.activeTabId = 'tab_1';
    harness.window.splitTabIds = ['tab_1', 'tab_2'];

    windClock(harness);
    vi.advanceTimersByTime(10 * 60 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('restarts the clock when a tab returns to screen', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    windClock(harness);
    vi.advanceTimersByTime(29 * MINUTE);

    // Looked at again, then left again — the countdown starts over.
    harness.window.activeTabId = 'tab_1';
    harness.sleeper.sweep();
    harness.window.activeTabId = null;
    harness.sleeper.sweep();

    vi.advanceTimersByTime(29 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('never sleeps an audible tab, however long it plays', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1', audible: true }));

    windClock(harness);
    vi.advanceTimersByTime(10 * 60 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('gives a tab a full countdown after its audio ends', () => {
    const harness = makeSleeper();
    const tab = fakeTab({ id: 'tab_1', audible: true });
    harness.tabs.push(tab);

    windClock(harness);
    vi.advanceTimersByTime(10 * 60 * MINUTE);
    harness.sleeper.sweep();

    // The podcast finishes. It must not sleep on the very next sweep just
    // because it has been off screen for hours.
    tab.audible = false;
    harness.sleeper.sweep();
    vi.advanceTimersByTime(29 * MINUTE);
    harness.sleeper.sweep();
    expect(harness.slept).toEqual([]);

    vi.advanceTimersByTime(2 * MINUTE);
    harness.sleeper.sweep();
    expect(harness.slept).toEqual(['tab_1']);
  });

  it('does nothing while sleepEnabled is off', () => {
    const harness = makeSleeper();
    harness.settings.sleepEnabled = false;
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    windClock(harness);
    vi.advanceTimersByTime(10 * 60 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('takes effect on the next sweep when sleepEnabled is switched on', () => {
    const harness = makeSleeper();
    harness.settings.sleepEnabled = false;
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    windClock(harness);
    vi.advanceTimersByTime(31 * MINUTE);
    harness.sleeper.sweep();
    expect(harness.slept).toEqual([]);

    harness.settings.sleepEnabled = true;
    harness.sleeper.sweep();
    expect(harness.slept).toEqual(['tab_1']);
  });

  it('honours the sleepAfterMinutes threshold', () => {
    const harness = makeSleeper();
    harness.settings.sleepAfterMinutes = 5;
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    windClock(harness);
    vi.advanceTimersByTime(6 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual(['tab_1']);
  });

  it('spares pinned tabs unless sleepPinnedTabs is on', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1', pinned: true }));

    windClock(harness);
    vi.advanceTimersByTime(31 * MINUTE);
    harness.sleeper.sweep();
    expect(harness.slept).toEqual([]);

    harness.settings.sleepPinnedTabs = true;
    harness.sleeper.sweep();
    expect(harness.slept).toEqual(['tab_1']);
  });

  it('skips internal pages, which hold no view to free', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1', url: INTERNAL_PAGES.newTab }));

    windClock(harness);
    vi.advanceTimersByTime(31 * MINUTE);
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('does not re-sleep a sleeping tab', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1', asleep: true }));

    windClock(harness);
    vi.advanceTimersByTime(31 * MINUTE);
    harness.sleeper.sweep();
    harness.sleeper.sweep();

    expect(harness.slept).toEqual([]);
  });

  it('forgets closed tabs instead of growing a map for the life of the app', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    windClock(harness);
    const clock = harness.sleeper as unknown as { idleSince: Map<string, number> };
    expect(clock.idleSince.size).toBe(1);

    harness.tabs.length = 0;
    harness.sleeper.sweep();
    expect(clock.idleSince.size).toBe(0);
  });

  it('sweeps on the interval once started, and stops on stop()', () => {
    const harness = makeSleeper();
    harness.tabs.push(fakeTab({ id: 'tab_1' }));

    harness.sleeper.start();
    vi.advanceTimersByTime(LIMITS.tabSweepIntervalMs);
    vi.advanceTimersByTime(31 * MINUTE);
    expect(harness.slept).toEqual(['tab_1']);

    harness.sleeper.stop();
    harness.tabs.push(fakeTab({ id: 'tab_2' }));
    vi.advanceTimersByTime(10 * 60 * MINUTE);
    expect(harness.slept).toEqual(['tab_1']);
  });
});
