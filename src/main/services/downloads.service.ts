import { existsSync } from 'node:fs';
import { join, parse } from 'node:path';
import { shell, type DownloadItem, type Session } from 'electron';
import type { Download, DownloadSafety, DownloadState, Profile } from '@shared/types';
import { LIMITS } from '@shared/constants';
import { createId, throttle } from '@shared/utils';
import type { DownloadPatch, Repositories } from '../storage';
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
  /**
   * The row exactly as last written. Kept in step with every patch so a progress
   * tick can publish without reading back what it just wrote.
   */
  record: Download;
  lastBytes: number;
  lastTime: number;
  speed: number;
  etaSeconds: number | null;
  /** Bound per download, so concurrent transfers each get their own window. */
  publishProgress: () => void;
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

  /**
   * Trigger an explicit download on a given session.
   *
   * Deliberately takes no save path. Chromium decides the target in
   * `will-download`, where {@link handleWillDownload} applies the user's
   * download directory and the {@link uniqueSavePath} anti-clobber walk — the
   * one place that decision is made. A per-call path would have to be
   * correlated back through `will-download`, which identifies a transfer by
   * nothing but its URL, and would let a caller write to an arbitrary location
   * behind the user's chosen directory. `downloads.start` advertised one in its
   * schema and nothing ever read it.
   */
  startOnSession(session: Session, url: string): void {
    session.downloadURL(url);
  }

  /**
   * Reconcile downloads that a previous run left mid-transfer.
   *
   * A download's live state belongs to a `DownloadItem`, and no `DownloadItem`
   * outlives the process that created it. Any row still claiming `in_progress`
   * or `paused` at boot is therefore a transfer that the last run never
   * finished — it has been `interrupted` since the moment the app quit, and
   * nothing else will ever say so. Left alone it sits in the active list behind
   * a progress bar frozen forever, offering a Pause and a Cancel with nothing
   * to act on.
   *
   * Boot is the one moment this is safe: no `will-download` has been handled
   * yet, so every live state in the table is stale by definition.
   */
  reconcileInterrupted(): void {
    try {
      const reconciled = this.repos.downloads.markInterrupted();
      if (reconciled > 0) {
        this.logger.info(
          `marked ${reconciled} download(s) left running by the last run interrupted`,
        );
      }
    } catch (error) {
      // Housekeeping — never let it stop the browser opening.
      this.logger.warn('failed to reconcile interrupted downloads', error);
    }
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
      record,
      lastBytes: record.receivedBytes,
      lastTime: now,
      speed: 0,
      etaSeconds: null,
      publishProgress: throttle(() => this.publishProgress(id), LIMITS.downloadSampleMs),
    };
    this.live.set(id, live);
    this.events.emit({ type: 'download:created', download: this.merge(record, live) });

    // The event's own `state` argument is not forwarded: a throttled tick must
    // read the item when it fires, not carry an argument from when it was
    // scheduled. See `publishProgress`.
    item.on('updated', () => live.publishProgress());
    item.once('done', (_event, state) => {
      void this.onDone(id, item, state);
    });
  }

  list(profileId: string): Download[] {
    return this.repos.downloads
      .list(profileId)
      .map((record) => this.merge(record, this.live.get(record.id)));
  }

  /**
   * The live transfer behind `id`, or a thrown error, so the renderer's toast
   * can run.
   *
   * Only a `DownloadItem` can pause, resume or cancel a transfer, and no
   * `DownloadItem` survives the process that created it — so a row restored
   * from disk has nothing to act on. Reporting success for a control that did
   * nothing is exactly the silent lie `openFile` told before v0.2.2j.
   */
  private liveOrThrow(id: string): LiveDownload {
    const live = this.live.get(id);
    if (!live) {
      this.logger.warn(`no live transfer for ${id}: it did not start in this session`);
      throw new Error('This download is no longer running');
    }
    return live;
  }

  pause(id: string): void {
    this.liveOrThrow(id).item.pause();
  }

  resume(id: string): void {
    const { item } = this.liveOrThrow(id);
    // Chromium alone knows whether the server allows a restart from an offset.
    if (!item.canResume()) throw new Error('This download cannot be resumed');
    item.resume();
  }

  cancel(id: string): void {
    this.liveOrThrow(id).item.cancel();
  }

  /**
   * Unlike the controls above, this must work for a restored row: removing an
   * entry from the list is a thing we can always do, live item or not.
   *
   * Forgotten before it is cancelled, not after. `done` fires asynchronously, so
   * a still-live entry would let `onDone` publish a `download:updated` for the
   * row this just deleted — and the renderer's store upserts by id, which would
   * put the removed download straight back in the list.
   */
  remove(id: string): void {
    const live = this.live.get(id);
    if (live) {
      this.live.delete(id);
      live.item.cancel();
    }
    this.repos.downloads.remove(id);
  }

  clearCompleted(profileId: string): void {
    this.repos.downloads.clearCompleted(profileId);
  }

  /**
   * Throws if the file cannot be opened, so the renderer's error toast can run.
   *
   * `shell.openPath` **resolves** to an error message rather than rejecting —
   * an empty string means success — so `void`ing it discarded the only report
   * of a file that had been moved or deleted, and the router said `true`
   * regardless. Clicking Open did nothing at all: no error, no log.
   */
  async openFile(id: string): Promise<void> {
    const record = this.repos.downloads.get(id);
    if (!record) throw new Error('Download not found');
    const failure = await shell.openPath(record.savePath);
    if (failure) {
      this.logger.warn(`failed to open ${record.savePath}: ${failure}`);
      throw new Error(failure);
    }
  }

  showInFolder(id: string): void {
    const record = this.repos.downloads.get(id);
    if (!record) throw new Error('Download not found');
    // Unlike `openPath`, this reports nothing at all — so check first, and give
    // the one failure we can detect a real error instead of silence.
    if (!existsSync(record.savePath)) {
      this.logger.warn(`cannot reveal a missing file: ${record.savePath}`);
      throw new Error('The file is no longer there');
    }
    shell.showItemInFolder(record.savePath);
  }

  /**
   * Persist and publish one progress sample.
   *
   * Throttled per download to `LIMITS.downloadSampleMs` — the window the
   * constant always documented and nothing was ever wired to. `updated` fires
   * far faster than that on a quick connection, and every single tick used to
   * run a synchronous `UPDATE` plus a `SELECT` read-back on the main process.
   *
   * Everything is read from the item at the moment the tick fires rather than
   * when it was scheduled: `throttle`'s trailing call carries the arguments of
   * the call that scheduled it, so a tick landing after `done` would otherwise
   * drag a finished download back to `in_progress`.
   */
  private publishProgress(id: string): void {
    const live = this.live.get(id);
    // `done` stamps `completedAt` and owns the row from that moment on.
    if (!live || live.record.completedAt !== null) return;

    const { item } = live;
    const now = Date.now();
    const received = item.getReceivedBytes();
    const elapsedMs = now - live.lastTime;
    // A sample needs a full window behind it: the leading-edge tick fires the
    // instant a transfer starts, and dividing by ~0 elapsed invents a speed.
    if (elapsedMs >= LIMITS.downloadSampleMs) {
      live.speed = Math.max(0, ((received - live.lastBytes) / elapsedMs) * 1000);
      const total = item.getTotalBytes();
      live.etaSeconds = live.speed > 0 && total > 0 ? (total - received) / live.speed : null;
      live.lastBytes = received;
      live.lastTime = now;
    }

    const nextState: DownloadState =
      item.getState() === 'interrupted'
        ? 'interrupted'
        : item.isPaused()
          ? 'paused'
          : 'in_progress';

    this.write(live, {
      state: nextState,
      receivedBytes: received,
      totalBytes: item.getTotalBytes(),
      savePath: item.getSavePath() || live.record.savePath,
    });
    this.events.emit({ type: 'download:updated', download: this.merge(live.record, live) });
  }

  /**
   * Write a patch through to the row and keep the cached copy in step, so the
   * progress path never reads back what it just wrote.
   *
   * Every value must be defined: `updateColumns` reads `undefined` as "leave
   * this column alone", and spreading such a hole over the record would write
   * it back as a real value.
   */
  private write(live: LiveDownload, patch: DownloadPatch): void {
    this.repos.downloads.update(live.record.id, patch);
    live.record = { ...live.record, ...patch };
  }

  private async onDone(
    id: string,
    item: DownloadItem,
    state: 'completed' | 'cancelled' | 'interrupted',
  ): Promise<void> {
    const live = this.live.get(id);
    if (!live) return;

    const nextState: DownloadState =
      state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted';

    this.write(live, {
      state: nextState,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      savePath: item.getSavePath() || live.record.savePath,
      completedAt: Date.now(),
    });
    this.events.emit({ type: 'download:updated', download: this.merge(live.record, live) });

    if (nextState === 'completed' && this.settings.get().security.scanDownloads) {
      this.write(live, { safety: 'scanning' });
      try {
        const safety = await this.scanner(item.getSavePath(), item.getURL());
        this.write(live, { safety });
      } catch (error) {
        this.logger.warn('download safety scan failed', error);
        this.write(live, { safety: 'unknown' });
      }
      // Published unmerged: the transfer is over, so the live speed and ETA
      // overlay has nothing left to say about it.
      this.events.emit({ type: 'download:updated', download: live.record });
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
