/** Centralised tunable limits and thresholds used across the browser. */
export const LIMITS = {
  /** Recently-closed tabs retained for restoration. */
  maxRecentlyClosed: 25,
  /** Maximum omnibox results returned to the renderer per query. */
  maxOmniboxResults: 10,
  /** Debounce for omnibox suggestion fetches, ms. */
  omniboxDebounceMs: 90,
  /** Tab thumbnail capture dimensions. */
  thumbnailWidth: 360,
  thumbnailHeight: 225,
  /** Interval for the sleeping-tab sweeper, ms. */
  tabSweepIntervalMs: 60_000,
  /**
   * Tabs allowed to materialise a view and perform their first load at once.
   * Bounds the renderer-process storm from opening many tabs in quick
   * succession; further loads wait for a slot. See {@link TabLoadScheduler}.
   */
  maxConcurrentTabLoads: 6,
  /**
   * How long one such load may hold its slot before it stops blocking others,
   * ms. A hung page keeps loading — it just no longer starves the queue.
   */
  tabLoadSlotTimeoutMs: 12_000,
  /** Default idle threshold before a tab may sleep, minutes. */
  defaultSleepAfterMinutes: 30,
  /** Session autosave cadence, ms. */
  sessionAutosaveMs: 15_000,
  /** Saved sessions retained; older ones are pruned. */
  savedSessions: 15,
  /** History retention window in days (0 = keep forever). */
  historyRetentionDays: 90,
  /** Download speed sampling window, ms. */
  downloadSampleMs: 1_000,
  /** Maximum concurrent AI streaming requests. */
  maxAiConcurrency: 4,
} as const;
