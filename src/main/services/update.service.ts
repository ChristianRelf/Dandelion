import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import electronUpdater from 'electron-updater';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';

const { autoUpdater } = electronUpdater;

export interface UpdateCheckResult {
  updateAvailable: boolean;
  version: string;
}

/**
 * Wraps `electron-updater` behind a small surface. Update checking is disabled
 * in development; in production it uses the GitHub Releases feed configured in
 * `electron-builder.yml`.
 */
export class UpdateService {
  constructor(
    private readonly events: EventBus,
    private readonly logger: Logger,
  ) {
    autoUpdater.autoDownload = false;
    autoUpdater.logger = null;
    autoUpdater.on('update-available', (info) => {
      this.events.emit({ type: 'app:update-available', version: info.version });
    });
    autoUpdater.on('error', (error) => this.logger.warn('auto-update error', error));
  }

  currentVersion(): string {
    return app.getVersion();
  }

  async check(): Promise<UpdateCheckResult> {
    if (is.dev) return { updateAvailable: false, version: app.getVersion() };
    try {
      const result = await autoUpdater.checkForUpdates();
      const version = result?.updateInfo.version ?? app.getVersion();
      return { updateAvailable: version !== app.getVersion(), version };
    } catch (error) {
      this.logger.warn('update check failed', error);
      return { updateAvailable: false, version: app.getVersion() };
    }
  }

  async download(): Promise<void> {
    if (!is.dev) await autoUpdater.downloadUpdate();
  }

  quitAndInstall(): void {
    if (!is.dev) autoUpdater.quitAndInstall();
  }
}
