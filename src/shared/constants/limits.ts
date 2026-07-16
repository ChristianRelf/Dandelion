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
  /** Default idle threshold before a tab may sleep, minutes. */
  defaultSleepAfterMinutes: 30,
  /** Session autosave cadence, ms. */
  sessionAutosaveMs: 15_000,
  /** History retention window in days (0 = keep forever). */
  historyRetentionDays: 90,
  /** Download speed sampling window, ms. */
  downloadSampleMs: 1_000,
  /** Maximum concurrent AI streaming requests. */
  maxAiConcurrency: 4,
} as const;
