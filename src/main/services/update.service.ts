import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import electronUpdater from 'electron-updater';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';
import type { SettingsService } from './settings.service';

const { autoUpdater } = electronUpdater;

/** Wait this long after launch before the first check, so startup stays clear. */
const FIRST_CHECK_DELAY_MS = 15_000;

/** Long-running windows are normal for a browser, so keep checking. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface UpdateCheckResult {
  updateAvailable: boolean;
  version: string;
}

/**
 * Wraps `electron-updater` behind a small surface, using the GitHub Releases
 * feed configured in `electron-builder.yml`.
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
  /** Set once an update is on disk, so the UI can offer to restart into it. */
  private downloadedVersion: string | null = null;
  private timer: NodeJS.Timeout | null = null;

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
      this.events.emit({ type: 'app:update-available', version: info.version });
    });
    autoUpdater.on('update-downloaded', (info) => {
      this.downloadedVersion = info.version;
      this.logger.info(`update downloaded: ${info.version}`);
      this.events.emit({ type: 'app:update-downloaded', version: info.version });
    });
    autoUpdater.on('error', (error) => this.logger.warn('auto-update error', error));
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

  /** The version waiting on disk, or null when nothing is ready to install. */
  pendingVersion(): string | null {
    return this.downloadedVersion;
  }

  async check(): Promise<UpdateCheckResult> {
    const current = app.getVersion();
    if (is.dev) return { updateAvailable: false, version: current };
    // Already downloaded: report that rather than checking the feed again.
    if (this.downloadedVersion) {
      return { updateAvailable: true, version: this.downloadedVersion };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      const version = result?.updateInfo.version ?? current;
      return { updateAvailable: version !== current, version };
    } catch (error) {
      this.logger.warn('update check failed', error);
      return { updateAvailable: false, version: current };
    }
  }

  /**
   * Restart into the downloaded update. Does nothing unless one is ready —
   * `quitAndInstall` with nothing downloaded quits without reopening.
   */
  install(): boolean {
    if (is.dev || !this.downloadedVersion) return false;
    autoUpdater.quitAndInstall();
    return true;
  }
}
