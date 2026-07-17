/**
 * Where the updater is right now.
 *
 * The main process is the sole owner; every surface mirrors this from
 * `app:update-status` rather than assembling its own picture from fragments.
 *
 * There is deliberately no `available` phase. Downloads start automatically, so
 * "a newer version exists" and "it is being fetched" are the same instant — a
 * phase nobody could ever observe is a phase worth not having.
 */
export type UpdateStatus =
  /** Nothing checked yet this run. */
  | { phase: 'idle' }
  | { phase: 'checking' }
  /** Checked, and this is the newest version. */
  | { phase: 'current'; version: string; checkedAt: number }
  | {
      phase: 'downloading';
      version: string;
      /** 0–100, already rounded — the UI should not have to. */
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      /** 0 when the feed served no length, which the UI must treat as unknown. */
      total: number;
    }
  /** On disk and waiting for the restart the user chooses. */
  | {
      phase: 'ready';
      version: string;
      /**
       * Epoch ms, or null when the feed served no date or an unparseable one.
       * Resolved in main so no surface has to re-parse a value from the feed.
       */
      releasedAt: number | null;
      releaseUrl: string;
    }
  /** A summary safe to display; the cause is in the main-process log. */
  | { phase: 'error'; message: string };

export type UpdatePhase = UpdateStatus['phase'];
