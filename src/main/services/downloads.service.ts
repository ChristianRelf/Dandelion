import { existsSync } from 'node:fs';
import { join, parse } from 'node:path';
import { shell, type DownloadItem, type Session } from 'electron';
import type { Download, DownloadSafety, DownloadState, Profile } from '@shared/types';
import { createId } from '@shared/utils';
import type { Repositories } from '../storage';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';
import type { SettingsService } from './settings.service';
import { defaultDownloadsDir } from '../core/paths';

/** A pluggable hook for malware/safety scanning of a completed download. */
export type SafetyScanner = (
  filePath: string,
  url: string,
) => Promise<DownloadSafety> | DownloadSafety;

const defaultScanner: SafetyScanner = (filePath) =>
  /\.(exe|scr|bat|cmd|com|msi|ps1|jar|vbs|js|dmg|pkg)$/i.test(filePath) ? 'unknown' : 'safe';

/**
 * A free path for `filename` in `dir`, walking `name (1).ext`, `name (2).ext` …
 * until one is unused.
 *
 * Chromium uniquifies download targets itself, but only while it owns the
 * decision — calling `item.setSavePath()` opts out of that routine entirely, so
 * without this a second download of the same name truncates the first.
 *
 * `taken` is injected so the walk can be tested without touching the disk.
 */
export function uniqueSavePath(
  dir: string,
  filename: string,
  taken: (path: string) => boolean = existsSync,
): string {
  const first = join(dir, filename);
  if (!taken(first)) return first;

  const { name, ext } = parse(filename);
  for (let n = 1; ; n += 1) {
    const candidate = join(dir, `${name} (${n})${ext}`);
    if (!taken(candidate)) return candidate;
  }
}

interface LiveDownload {
  item: DownloadItem;
  profileId: string;
  lastBytes: number;
  lastTime: number;
  speed: number;
  etaSeconds: number | null;
}

/**
 * Tracks the full lifecycle of every download: creates a durable record,
 * samples transfer speed / ETA, drives pause/resume/cancel, persists progress
 * and runs the safety scanner on completion.
 */
export class DownloadsService {
  private readonly live = new Map<string, LiveDownload>();
  private scanner: SafetyScanner = defaultScanner;

  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
    private readonly settings: SettingsService,
    private readonly logger: Logger,
  ) {}

  setScanner(scanner: SafetyScanner): void {
    this.scanner = scanner;
  }

  /** Trigger an explicit download on a given session. */
  startOnSession(session: Session, url: string): void {
    session.downloadURL(url);
  }

  /** Wired into `session.on('will-download')`. */
  handleWillDownload(profile: Profile, item: DownloadItem): void {
    const id = createId('dl');
    const filename = item.getFilename();
    const settings = this.settings.get();

    if (!settings.behavior.askWhereToSaveDownloads) {
      const dir = settings.behavior.downloadDirectory ?? defaultDownloadsDir();
      item.setSavePath(uniqueSavePath(dir, filename));
    }

    const now = Date.now();
    const record: Download = {
      id,
      profileId: profile.id,
      url: item.getURL(),
      filename,
      savePath: item.getSavePath() || join(defaultDownloadsDir(), filename),
      mimeType: item.getMimeType(),
      state: 'in_progress',
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      speed: 0,
      etaSeconds: null,
      paused: false,
      canResume: false,
      safety: 'unknown',
      referrer: null,
      startedAt: now,
      completedAt: null,
    };
    this.repos.downloads.insert(record);

    const live: LiveDownload = {
      item,
      profileId: profile.id,
      lastBytes: record.receivedBytes,
      lastTime: now,
      speed: 0,
      etaSeconds: null,
    };
    this.live.set(id, live);
    this.events.emit({ type: 'download:created', download: this.merge(record, live) });

    item.on('updated', (_event, state) => this.onUpdated(id, item, state));
    item.once('done', (_event, state) => {
      void this.onDone(id, item, state);
    });
  }

  list(profileId: string): Download[] {
    return this.repos.downloads
      .list(profileId)
      .map((record) => this.merge(record, this.live.get(record.id)));
  }

  pause(id: string): void {
    this.live.get(id)?.item.pause();
  }

  resume(id: string): void {
    const live = this.live.get(id);
    if (live?.item.canResume()) live.item.resume();
  }

  cancel(id: string): void {
    this.live.get(id)?.item.cancel();
  }

  remove(id: string): void {
    this.live.get(id)?.item.cancel();
    this.repos.downloads.remove(id);
  }

  clearCompleted(profileId: string): void {
    this.repos.downloads.clearCompleted(profileId);
  }

  openFile(id: string): void {
    const record = this.repos.downloads.get(id);
    if (record) void shell.openPath(record.savePath);
  }

  showInFolder(id: string): void {
    const record = this.repos.downloads.get(id);
    if (record) shell.showItemInFolder(record.savePath);
  }

  private onUpdated(id: string, item: DownloadItem, state: 'progressing' | 'interrupted'): void {
    const live = this.live.get(id);
    if (!live) return;

    const now = Date.now();
    const received = item.getReceivedBytes();
    const elapsed = (now - live.lastTime) / 1000;
    if (elapsed >= 1) {
      live.speed = Math.max(0, (received - live.lastBytes) / elapsed);
      const total = item.getTotalBytes();
      live.etaSeconds = live.speed > 0 && total > 0 ? (total - received) / live.speed : null;
      live.lastBytes = received;
      live.lastTime = now;
    }

    const paused = item.isPaused();
    const nextState: DownloadState =
      state === 'interrupted' ? 'interrupted' : paused ? 'paused' : 'in_progress';

    this.repos.downloads.update(id, {
      state: nextState,
      receivedBytes: received,
      totalBytes: item.getTotalBytes(),
      savePath: item.getSavePath() || undefined,
    });
    const record = this.repos.downloads.get(id);
    if (record) this.events.emit({ type: 'download:updated', download: this.merge(record, live) });
  }

  private async onDone(
    id: string,
    item: DownloadItem,
    state: 'completed' | 'cancelled' | 'interrupted',
  ): Promise<void> {
    const live = this.live.get(id);
    const nextState: DownloadState =
      state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';

    this.repos.downloads.update(id, {
      state: nextState,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      savePath: item.getSavePath() || undefined,
      completedAt: Date.now(),
    });
    let record = this.repos.downloads.get(id);
    if (record) this.events.emit({ type: 'download:updated', download: this.merge(record, live) });

    if (nextState === 'completed' && this.settings.get().security.scanDownloads) {
      this.repos.downloads.update(id, { safety: 'scanning' });
      try {
        const safety = await this.scanner(item.getSavePath(), item.getURL());
        this.repos.downloads.update(id, { safety });
      } catch (error) {
        this.logger.warn('download safety scan failed', error);
        this.repos.downloads.update(id, { safety: 'unknown' });
      }
      record = this.repos.downloads.get(id);
      if (record) this.events.emit({ type: 'download:updated', download: record });
    }

    this.live.delete(id);
  }

  private merge(record: Download, live: LiveDownload | undefined): Download {
    if (!live) return record;
    return {
      ...record,
      speed: live.speed,
      etaSeconds: live.etaSeconds,
      paused: live.item.isPaused(),
      canResume: live.item.canResume(),
    };
  }
}
