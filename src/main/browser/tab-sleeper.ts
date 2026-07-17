import { isInternalUrl, LIMITS } from '@shared/constants';
import type { Logger } from '../core/logger';
import type { SettingsService } from '../services/settings.service';
import type { TabManager } from './tab-manager';
import type { WindowManager } from './window-manager';

export interface TabSleeperDeps {
  tabs: TabManager;
  windows: WindowManager;
  settings: SettingsService;
  logger: Logger;
}

/**
 * Drives `tabs.sleepEnabled` / `tabs.sleepAfterMinutes`.
 *
 * `TabManager.sleep()` has always been correct; nothing ever called it on a
 * timer, so Settings offered "Sleep inactive tabs" — on by default — over a
 * feature that did not exist. This is that timer.
 *
 * It owns the idle clock rather than reading `Tab.lastActiveAt`, because that
 * field records when a tab *became* active, not when it stopped being on
 * screen. A tab read for three hours and then switched away from carries a
 * three-hour-old `lastActiveAt` and would sleep on the next sweep, a minute
 * after the user last looked at it — losing its scroll position and form state.
 * `lastActiveAt` also backs the Ctrl+Tab MRU order, so it cannot be repurposed.
 *
 * The clock is maintained by observing which tabs are on screen each sweep
 * rather than by hooking every transition (activate, split, window close). The
 * cost is up to one interval of imprecision on when a tab's clock starts; the
 * benefit is that no future on-screen path can forget to wind it.
 */
export class TabSleeper {
  /** Tab id → when it left the screen. Absent while a tab is on screen. */
  private readonly idleSince = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: TabSleeperDeps) {}

  /** Begin sweeping. Safe to call once at startup; idempotent. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.sweep(), LIMITS.tabSweepIntervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.idleSince.clear();
  }

  /**
   * One pass. Exposed for tests; `start()` is the production caller.
   *
   * The `sleepEnabled` gate is read here rather than in `start()` so toggling
   * the setting takes effect on the next sweep instead of at the next restart.
   */
  sweep(): void {
    const now = Date.now();
    const { sleepEnabled, sleepAfterMinutes, sleepPinnedTabs } = this.deps.settings.get().tabs;
    const thresholdMs = sleepAfterMinutes * 60_000;
    const onScreen = this.onScreenTabIds();
    const liveTabIds = new Set<string>();
    let slept = 0;

    for (const tab of this.deps.tabs.listAll()) {
      liveTabIds.add(tab.id);

      // On screen is not idle — including the far half of a split.
      if (onScreen.has(tab.id)) {
        this.idleSince.delete(tab.id);
        continue;
      }

      // Audible tabs are never idle: a background tab playing music is being
      // used. Winding the clock forward while it plays also means the audio
      // ending starts a fresh countdown rather than sleeping it immediately.
      if (tab.audible) {
        this.idleSince.set(tab.id, now);
        continue;
      }

      const since = this.idleSince.get(tab.id);
      if (since === undefined) {
        this.idleSince.set(tab.id, now);
        continue;
      }

      if (!sleepEnabled) continue;
      if (tab.asleep) continue;
      if (tab.pinned && !sleepPinnedTabs) continue;
      // Internal pages hold no WebContentsView, so sleeping one frees nothing
      // and only dims its row in the strip.
      if (isInternalUrl(tab.url)) continue;
      if (now - since < thresholdMs) continue;

      this.deps.tabs.sleep(tab.id);
      slept += 1;
    }

    for (const tabId of this.idleSince.keys()) {
      if (!liveTabIds.has(tabId)) this.idleSince.delete(tabId);
    }

    if (slept > 0) {
      this.deps.logger.info(`slept ${slept} tab(s) idle for over ${sleepAfterMinutes}m`);
    }
  }

  /** Every tab currently visible in any window: the active tab plus split panes. */
  private onScreenTabIds(): Set<string> {
    const ids = new Set<string>();
    for (const dandelionWindow of this.deps.windows.all()) {
      if (dandelionWindow.activeTabId) ids.add(dandelionWindow.activeTabId);
      for (const tabId of dandelionWindow.splitTabIds) ids.add(tabId);
    }
    return ids;
  }
}
