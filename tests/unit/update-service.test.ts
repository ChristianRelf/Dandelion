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

  it('announces a downloaded update and remembers it', () => {
    const { service, emit } = makeService();
    expect(service.pendingVersion()).toBeNull();

    fire('update-downloaded', { version: '1.2.0' });

    expect(service.pendingVersion()).toBe('1.2.0');
    expect(emit).toHaveBeenCalledWith({ type: 'app:update-downloaded', version: '1.2.0' });
  });

  it('reports the downloaded version without hitting the feed again', async () => {
    const { service } = makeService();
    fire('update-downloaded', { version: '1.2.0' });

    await expect(service.check()).resolves.toEqual({ updateAvailable: true, version: '1.2.0' });
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('reports being up to date when the feed matches', async () => {
    autoUpdater.checkForUpdates.mockResolvedValue({ updateInfo: { version: '1.0.0' } });
    const { service } = makeService();
    await expect(service.check()).resolves.toEqual({ updateAvailable: false, version: '1.0.0' });
  });

  it('survives a feed that is unreachable', async () => {
    autoUpdater.checkForUpdates.mockRejectedValue(new Error('offline'));
    const { service } = makeService();
    await expect(service.check()).resolves.toEqual({ updateAvailable: false, version: '1.0.0' });
  });

  it('refuses to install with nothing downloaded, so the app cannot quit without reopening', () => {
    const { service } = makeService();
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
