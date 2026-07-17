import type { Logger } from '../core/logger';

export interface TabLoadSchedulerDeps {
  /** Tabs allowed to materialise a view and perform their first load at once. */
  maxConcurrent: number;
  /** How long a single load may hold its slot before it stops blocking others, ms. */
  slotTimeoutMs: number;
  /** Whether a tab is currently on screen in its window (the active tab or a split pane). */
  isOnScreen: (tabId: string) => boolean;
  /**
   * Materialise the tab's view and begin its first load. Returns whether a load
   * actually started: an internal page or an already-loaded tab consumes no slot.
   */
  startLoad: (tabId: string) => boolean;
  logger: Logger;
}

/**
 * Bounds how many tabs perform their first, view-materialising load at once.
 *
 * Opening hundreds of tabs in quick succession — a page firing `window.open` in
 * a loop, the usual cause — otherwise spawns a renderer process and a network
 * load for every one in a single synchronous burst and freezes the browser. Here
 * each cold load takes a slot; once the cap is reached, further loads wait.
 *
 * As slots free, waiting tabs are admitted in order — but a tab that is no longer
 * on screen when its turn comes is left unloaded, to materialise the next time it
 * is activated. So a burst of foreground opens settles into "the tab you end up
 * looking at, plus a few", never hundreds of live views.
 *
 * Only the view and its load are scheduled. Tab *state* is created by the
 * TabManager the instant a tab opens, so every tab appears in the strip at once
 * regardless of where its load sits in the queue.
 */
export class TabLoadScheduler {
  /** Tabs whose load is underway and holding a slot. */
  private readonly inflight = new Set<string>();
  /** Tabs waiting for a slot, oldest first. Mirrored by {@link queued} for O(1) membership. */
  private readonly queue: string[] = [];
  private readonly queued = new Set<string>();
  /** Per-load watchdogs, so a hung page eventually releases its slot. */
  private readonly watchdogs = new Map<string, NodeJS.Timeout>();

  constructor(private readonly deps: TabLoadSchedulerDeps) {}

  /**
   * Ask for a tab to load. Loads immediately when a slot is free; otherwise waits
   * its turn. A tab already loading or already queued is left as-is.
   */
  request(tabId: string): void {
    if (this.inflight.has(tabId) || this.queued.has(tabId)) return;
    if (this.inflight.size < this.deps.maxConcurrent) {
      this.begin(tabId);
      return;
    }
    this.queue.push(tabId);
    this.queued.add(tabId);
  }

  /**
   * A tab's load has settled, or the tab is gone: free its slot (or drop it from
   * the queue) and admit the next waiting tab. Safe to call for any tab id.
   */
  release(tabId: string): void {
    this.clearWatchdog(tabId);
    this.dropFromQueue(tabId);
    if (this.inflight.delete(tabId)) this.pump();
  }

  /** Tabs currently holding a load slot — for diagnostics and tests. */
  get activeLoadCount(): number {
    return this.inflight.size;
  }

  private begin(tabId: string): void {
    // An internal page or an already-loaded tab starts no load and takes no slot.
    if (!this.deps.startLoad(tabId)) return;
    this.inflight.add(tabId);
    const watchdog = setTimeout(() => {
      this.deps.logger.warn(`tab ${tabId} load exceeded its slot window; admitting the next`);
      // The view keeps loading; it simply stops blocking the queue.
      this.release(tabId);
    }, this.deps.slotTimeoutMs);
    watchdog.unref?.();
    this.watchdogs.set(tabId, watchdog);
  }

  private pump(): void {
    while (this.inflight.size < this.deps.maxConcurrent && this.queue.length > 0) {
      const tabId = this.queue.shift()!;
      this.queued.delete(tabId);
      // Superseded mid-burst: no longer on screen, so leave it unloaded rather
      // than spend a slot on a tab nobody is looking at. It loads when activated.
      if (this.deps.isOnScreen(tabId)) this.begin(tabId);
    }
  }

  private dropFromQueue(tabId: string): void {
    if (!this.queued.delete(tabId)) return;
    const index = this.queue.indexOf(tabId);
    if (index >= 0) this.queue.splice(index, 1);
  }

  private clearWatchdog(tabId: string): void {
    const watchdog = this.watchdogs.get(tabId);
    if (!watchdog) return;
    clearTimeout(watchdog);
    this.watchdogs.delete(tabId);
  }
}
