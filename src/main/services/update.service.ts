import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import electronUpdater from 'electron-updater';
import { APP_RELEASES_URL } from '@shared/constants';
import type { UpdateStatus } from '@shared/types';
import { throttle } from '@shared/utils';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';
import type { SettingsService } from './settings.service';

const { autoUpdater } = electronUpdater;

/** Wait this long after launch before the first check, so startup stays clear. */
const FIRST_CHECK_DELAY_MS = 15_000;

/** Long-running windows are normal for a browser, so keep checking. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * `download-progress` fires per chunk — far faster than a progress bar can show
 * or a human can read. Emitting each one would be pure IPC noise.
 */
const PROGRESS_INTERVAL_MS = 250;

/**
 * Shown when the feed cannot be reached. The underlying error carries feed URLs
 * and local paths, so the log gets the cause and the UI gets a summary.
 */
const UNREACHABLE_MESSAGE = 'Could not reach the update server.';

function releaseUrlFor(version: string): string {
  return `${APP_RELEASES_URL}/tag/v${version}`;
}

/**
 * The feed's release date as epoch ms, or null when it served none or one that
 * will not parse. Resolved here so no surface downstream can be handed a date
 * that turns into `NaN` the moment it is formatted.
 */
function parseReleaseDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * A whole percent in 0–100. A feed that serves no content length leaves
 * `electron-updater` dividing by zero, so a non-finite percent is real.
 */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Wraps `electron-updater` behind one observable state machine, using the
 * GitHub Releases feed configured in `electron-builder.yml`.
 *
 * Updates download automatically and are applied on the next restart — the
 * update is never installed underneath someone mid-browse. `automaticUpdates`
 * turns the background checks off; the manual check stays available either way,
 * because asking for an update is always an explicit choice.
 *
 * Nothing runs in development: there is no feed to check against, and a dev
 * build has no installer to replace.
 */
export class UpdateService {
  private current: UpdateStatus = { phase: 'idle' };
  private timer: NodeJS.Timeout | null = null;

  /**
   * Re-reads the phase when it actually fires, not when it was scheduled: a
   * trailing tick that lands after `update-downloaded` must not drag `ready`
   * back to `downloading`.
   */
  private readonly publishProgress = throttle(
    (percent: number, bytesPerSecond: number, transferred: number, total: number) => {
      if (this.current.phase !== 'downloading') return;
      this.set({
        phase: 'downloading',
        version: this.current.version,
        percent,
        bytesPerSecond,
        transferred,
        total,
      });
    },
    PROGRESS_INTERVAL_MS,
  );

  constructor(
    private readonly events: EventBus,
    private readonly logger: Logger,
    private readonly settings: SettingsService,
  ) {
    autoUpdater.autoDownload = true;
    // Applying an update while quitting would swap the app out from under a
    // session restore; the user restarts into it explicitly instead.
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = null;

    autoUpdater.on('update-available', (info) => {
      this.logger.info(`update available: ${info.version}`);
      this.set({
        phase: 'downloading',
        version: info.version,
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.publishProgress(
        clampPercent(progress.percent),
        progress.bytesPerSecond,
        progress.transferred,
        progress.total,
      );
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.logger.info(`update downloaded: ${info.version}`);
      this.set({
        phase: 'ready',
        version: info.version,
        releasedAt: parseReleaseDate(info.releaseDate),
        releaseUrl: releaseUrlFor(info.version),
      });
    });

    autoUpdater.on('error', (error) => {
      this.logger.warn('auto-update error', error);
      // A failure after the update is already on disk changes nothing: it is
      // still installable, and clearing it would lose a usable update.
      if (this.current.phase === 'ready') return;
      this.set({ phase: 'error', message: UNREACHABLE_MESSAGE });
    });
  }

  /**
   * Begin background checks. Safe to call once at startup; does nothing in
   * development or when the user has turned automatic updates off.
   */
  start(): void {
    if (is.dev || this.timer) return;
    if (!this.settings.get().behavior.automaticUpdates) return;

    this.timer = setTimeout(() => {
      void this.check();
      this.timer = setInterval(() => void this.check(), CHECK_INTERVAL_MS);
    }, FIRST_CHECK_DELAY_MS);
  }

  stop(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    clearInterval(this.timer);
    this.timer = null;
  }

  currentVersion(): string {
    return app.getVersion();
  }

  /** The whole updater state. Mirrored by every surface that shows it. */
  status(): UpdateStatus {
    return this.current;
  }

  /**
   * Check the feed, resolving to the status the check produced so a caller who
   * asked explicitly can react to it without racing the event.
   */
  async check(): Promise<UpdateStatus> {
    if (is.dev) return this.current;
    // Read the phase into a local: narrowing `this.current` directly would
    // outlive the `set` calls below, which the compiler cannot see through.
    const phase = this.current.phase;
    // Already fetching or fetched: report that rather than checking again.
    if (phase === 'downloading' || phase === 'ready') return this.current;

    this.set({ phase: 'checking' });
    try {
      await autoUpdater.checkForUpdates();
      // `update-available` moves us to `downloading` when there is one, so
      // still being in `checking` means this is the newest version.
      if (this.current.phase === 'checking') {
        this.set({ phase: 'current', version: app.getVersion(), checkedAt: Date.now() });
      }
    } catch (error) {
      this.logger.warn('update check failed', error);
      // Only the check itself failed. If anything else has since spoken — a
      // download starting, or the `error` handler — that is the truer state.
      if (this.current.phase === 'checking') {
        this.set({ phase: 'error', message: UNREACHABLE_MESSAGE });
      }
    }
    return this.current;
  }

  /**
   * Restart into the downloaded update. Does nothing unless one is ready —
   * `quitAndInstall` with nothing downloaded quits without reopening.
   */
  install(): boolean {
    if (is.dev || this.current.phase !== 'ready') return false;
    autoUpdater.quitAndInstall();
    return true;
  }

  private set(status: UpdateStatus): void {
    this.current = status;
    this.events.emit({ type: 'app:update-status', status });
  }
}
