import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for electron-updater's singleton, with a fireable event registry. */
const handlers = new Map<string, (payload: unknown) => void>();
const autoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: true,
  logger: {} as unknown,
  on: vi.fn((event: string, handler: (payload: unknown) => void) => {
    handlers.set(event, handler);
  }),
  checkForUpdates: vi.fn(),
  quitAndInstall: vi.fn(),
};

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0' } }));
vi.mock('electron-updater', () => ({ default: { autoUpdater } }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }));

const { UpdateService } = await import('@main/services/update.service');
import type { EventBus } from '@main/core/event-bus';
import type { Logger } from '@main/core/logger';
import type { SettingsService } from '@main/services/settings.service';

function makeService(automaticUpdates = true) {
  const emit = vi.fn();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() };
  const settings = { get: () => ({ behavior: { automaticUpdates } }) };
  const service = new UpdateService(
    { emit } as unknown as EventBus,
    logger as unknown as Logger,
    settings as unknown as SettingsService,
  );
  return { service, emit };
}

/** Deliver an electron-updater event to whatever the service registered. */
function fire(event: string, payload: unknown): void {
  handlers.get(event)?.(payload);
}

/** One `download-progress` payload; only `percent` usually matters to a test. */
function progress(percent: number) {
  return { percent, bytesPerSecond: 1_000, transferred: percent * 10, total: 1_000 };
}

beforeEach(() => {
  vi.useFakeTimers();
  handlers.clear();
  autoUpdater.checkForUpdates.mockReset();
  autoUpdater.quitAndInstall.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('UpdateService', () => {
  it('never applies an update while quitting — only on an explicit restart', () => {
    makeService();
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
    expect(autoUpdater.autoDownload).toBe(true);
  });

  it('starts idle', () => {
    const { service } = makeService();
    expect(service.status()).toEqual({ phase: 'idle' });
  });

  it('does not check in the background when automatic updates are off', async () => {
    const { service } = makeService(false);
    service.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('checks after launch settles, then keeps checking', async () => {
    autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.0.0' } });
    const { service } = makeService();
    service.start();

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
    service.stop();
  });

  it('stops checking once stopped', async () => {
    autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.0.0' } });
    const { service } = makeService();
    service.start();
    await vi.advanceTimersByTimeAsync(15_000);
    service.stop();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('treats an available update as already downloading, since autoDownload is on', () => {
    const { service, emit } = makeService();
    fire('update-available', { version: '1.2.0' });

    expect(service.status()).toEqual({
      phase: 'downloading',
      version: '1.2.0',
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
    });
    expect(emit).toHaveBeenCalledWith({ type: 'app:update-status', status: service.status() });
  });

  it('publishes download progress at most once per interval', () => {
    const { service, emit } = makeService();
    fire('update-available', { version: '1.2.0' });
    emit.mockClear();

    // The leading edge publishes; the rest of the burst collapses into one
    // trailing emit rather than one per chunk.
    fire('download-progress', progress(10));
    fire('download-progress', progress(20));
    fire('download-progress', progress(30));
    expect(emit).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(service.status()).toMatchObject({ phase: 'downloading', version: '1.2.0' });
  });

  it('rounds and clamps a percent the feed reports out of range', () => {
    const { service } = makeService();
    fire('update-available', { version: '1.2.0' });
    fire('download-progress', { ...progress(0), percent: 42.6 });

    expect(service.status()).toMatchObject({ percent: 43 });
  });

  it('does not let a late progress tick drag a ready update back to downloading', () => {
    const { service } = makeService();
    fire('update-available', { version: '1.2.0' });
    fire('download-progress', progress(50));
    // Queued behind the throttle, so it lands after the download finishes.
    fire('download-progress', progress(60));

    fire('update-downloaded', { version: '1.2.0', releaseDate: '2026-07-01T00:00:00Z' });
    vi.advanceTimersByTime(250);

    expect(service.status()).toMatchObject({ phase: 'ready', version: '1.2.0' });
  });

  it('announces a downloaded update with a link to its notes', () => {
    const { service, emit } = makeService();
    fire('update-downloaded', { version: '1.2.0', releaseDate: '2026-07-01T00:00:00Z' });

    expect(service.status()).toEqual({
      phase: 'ready',
      version: '1.2.0',
      releasedAt: Date.parse('2026-07-01T00:00:00Z'),
      releaseUrl: 'https://github.com/ChristianRelf/Dandelion/releases/tag/v1.2.0',
    });
    expect(emit).toHaveBeenCalledWith({ type: 'app:update-status', status: service.status() });
  });

  it('tolerates a feed that serves no release date', () => {
    const { service } = makeService();
    fire('update-downloaded', { version: '1.2.0' });
    expect(service.status()).toMatchObject({ phase: 'ready', releasedAt: null });
  });

  it('drops a release date that would not survive being formatted', () => {
    const { service } = makeService();
    fire('update-downloaded', { version: '1.2.0', releaseDate: 'the third of never' });
    expect(service.status()).toMatchObject({ phase: 'ready', releasedAt: null });
  });

  it('treats a percent from a feed that served no length as zero, not NaN', () => {
    const { service } = makeService();
    fire('update-available', { version: '1.2.0' });
    fire('download-progress', { percent: NaN, bytesPerSecond: 0, transferred: 0, total: 0 });

    expect(service.status()).toMatchObject({ percent: 0 });
  });

  it('reports a ready update without hitting the feed again', async () => {
    const { service } = makeService();
    fire('update-downloaded', { version: '1.2.0' });

    await expect(service.check()).resolves.toMatchObject({ phase: 'ready', version: '1.2.0' });
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('does not restart a download that is already in flight', async () => {
    const { service } = makeService();
    fire('update-available', { version: '1.2.0' });

    await expect(service.check()).resolves.toMatchObject({ phase: 'downloading' });
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('reports being up to date when the feed matches', async () => {
    autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.0.0' } });
    const { service } = makeService();

    await expect(service.check()).resolves.toMatchObject({ phase: 'current', version: '1.0.0' });
  });

  it('reports a failed check rather than claiming to be up to date', async () => {
    autoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'));
    const { service } = makeService();

    await expect(service.check()).resolves.toEqual({
      phase: 'error',
      message: 'Could not reach the update server.',
    });
  });

  it('summarises the failure instead of leaking the underlying error', () => {
    const { service } = makeService();
    fire('error', new Error('ENOENT: C:\\Users\\someone\\AppData\\Local\\dandelion-updater'));

    expect(service.status()).toEqual({
      phase: 'error',
      message: 'Could not reach the update server.',
    });
  });

  it('keeps an installable update when a later check fails', async () => {
    autoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'));
    const { service } = makeService();
    fire('update-downloaded', { version: '1.2.0' });

    fire('error', new Error('offline'));

    expect(service.status()).toMatchObject({ phase: 'ready', version: '1.2.0' });
    expect(service.install()).toBe(true);
  });

  it('refuses to install with nothing downloaded, so the app cannot quit without reopening', () => {
    const { service } = makeService();
    expect(service.install()).toBe(false);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('refuses to install a download still in flight', () => {
    const { service } = makeService();
    fire('update-available', { version: '1.2.0' });
    expect(service.install()).toBe(false);
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('installs once an update is on disk', () => {
    const { service } = makeService();
    fire('update-downloaded', { version: '1.2.0' });
    expect(service.install()).toBe(true);
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});
