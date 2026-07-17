import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  shell: { openPath: () => Promise.resolve(''), showItemInFolder: () => {} },
  app: { getPath: () => '/downloads' },
}));

const { DownloadsService } = await import('@main/services/downloads.service');
const { DownloadsRepository } = await import('@main/storage/repositories/downloads.repo');
import type { DownloadItem } from 'electron';
import type { BrowserEvent, DownloadSafety, Download, Profile } from '@shared/types';
import type { DownloadPatch, Repositories, SqliteDatabase } from '@main/storage';
import type { EventBus } from '@main/core/event-bus';
import type { Logger } from '@main/core/logger';
import type { SettingsService } from '@main/services/settings.service';
import { LIMITS } from '@shared/constants';

const PROFILE = { id: 'profile_1' } as Profile;

/**
 * A `DownloadItem` under the test's control. `tick` and `finish` deliver the
 * events Chromium would, so a test can land one at an exact moment.
 */
function makeItem(options: { canResume?: boolean } = {}) {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  let received = 0;
  let paused = false;
  let state = 'progressing';

  const item = {
    getFilename: () => 'report.pdf',
    getURL: () => 'https://example.com/report.pdf',
    getMimeType: () => 'application/pdf',
    getSavePath: () => '/downloads/report.pdf',
    setSavePath: () => {},
    getReceivedBytes: () => received,
    getTotalBytes: () => 1_000_000,
    getState: () => state,
    isPaused: () => paused,
    canResume: () => options.canResume ?? true,
    pause: vi.fn(() => {
      paused = true;
    }),
    resume: vi.fn(() => {
      paused = false;
    }),
    cancel: vi.fn(() => {
      state = 'cancelled';
    }),
    on: (event: string, handler: (...args: unknown[]) => void) => listeners.set(event, handler),
    once: (event: string, handler: (...args: unknown[]) => void) => listeners.set(event, handler),
  };

  return {
    item: item as unknown as DownloadItem,
    /** One `updated` event, having moved `bytes` in total. */
    tick: (bytes: number) => {
      received = bytes;
      listeners.get('updated')?.({}, state);
    },
    /** The terminal `done` event, carrying the outcome as Chromium does. */
    finish: (final: 'completed' | 'cancelled' | 'interrupted') => {
      state = final;
      listeners.get('done')?.({}, final);
    },
  };
}

function makeService(options: { scanDownloads?: boolean; orphans?: number } = {}) {
  const updates: Array<{ id: string; patch: DownloadPatch }> = [];
  const emitted: BrowserEvent[] = [];
  const removed: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];
  let reads = 0;
  let inserted: Download | null = null;

  const repos = {
    downloads: {
      insert: (record: Download) => {
        inserted = record;
      },
      update: (id: string, patch: DownloadPatch) => updates.push({ id, patch }),
      get: (): Download | null => {
        reads += 1;
        return inserted;
      },
      remove: (id: string) => removed.push(id),
      markInterrupted: () => {
        if (options.orphans === undefined) throw new Error('database is locked');
        return options.orphans;
      },
    },
  } as unknown as Repositories;

  const settings = {
    // `true` keeps `uniqueSavePath` — and the real filesystem — out of these
    // tests; it has its own in unique-save-path.test.ts.
    get: () => ({
      behavior: { askWhereToSaveDownloads: true, downloadDirectory: null },
      security: { scanDownloads: options.scanDownloads ?? false },
    }),
  } as unknown as SettingsService;

  const logger = {
    info: (message: string) => infos.push(message),
    warn: (message: string) => warnings.push(message),
    error: () => {},
  } as unknown as Logger;

  const service = new DownloadsService(
    repos,
    { emit: (event: BrowserEvent) => emitted.push(event) } as unknown as EventBus,
    settings,
    logger,
  );

  /** Register `item` with the service and hand back the id it minted. */
  const start = (item: DownloadItem): string => {
    service.handleWillDownload(PROFILE, item);
    const created = emitted.find((event) => event.type === 'download:created');
    if (created?.type !== 'download:created') throw new Error('no download:created event');
    return created.download.id;
  };

  return {
    service,
    start,
    updates,
    emitted,
    removed,
    warnings,
    infos,
    reads: () => reads,
    states: () => updates.map((entry) => entry.patch.state).filter(Boolean),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  // The throttle compares against `last = 0`, so the clock must be a real epoch
  // for its leading edge to behave as it does in the app.
  vi.setSystemTime(new Date('2026-07-17T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// The defect: `pause`/`resume`/`cancel` were `this.live.get(id)?.item.pause()`,
// and `live` is populated only by `handleWillDownload`. After a restart it is
// empty, so every control was a no-op lookup on a row restored from disk — and
// the router returned `true` regardless, leaving the renderer's
// `.catch(() => toast.error(...))` unreachable. Same silent lie `openFile` told
// before v0.2.2j.
describe('DownloadsService — controls on a download that is not live', () => {
  it('throws from pause rather than reporting success', () => {
    const { service } = makeService();
    expect(() => service.pause('dl_restored')).toThrow('This download is no longer running');
  });

  it('throws from resume rather than reporting success', () => {
    const { service } = makeService();
    expect(() => service.resume('dl_restored')).toThrow('This download is no longer running');
  });

  it('throws from cancel rather than reporting success', () => {
    const { service } = makeService();
    expect(() => service.cancel('dl_restored')).toThrow('This download is no longer running');
  });

  it('logs why the control could not act', () => {
    const { service, warnings } = makeService();
    expect(() => service.pause('dl_restored')).toThrow();
    expect(warnings[0]).toContain('dl_restored');
  });

  // Removing a row from the list needs no live item, so this one must not throw
  // — it is the only control that still works after a restart.
  it('still removes a restored row from the list', () => {
    const { service, removed } = makeService();
    expect(() => service.remove('dl_restored')).not.toThrow();
    expect(removed).toEqual(['dl_restored']);
  });
});

describe('DownloadsService.remove', () => {
  it('cancels the live transfer and deletes the row', () => {
    const { service, start, removed } = makeService();
    const { item } = makeItem();
    const id = start(item);

    service.remove(id);
    expect(item.cancel).toHaveBeenCalledOnce();
    expect(removed).toEqual([id]);
  });

  // `done` arrives after `remove` has deleted the row, and the renderer's store
  // upserts by id — so an update published here puts the removed download back
  // in the list. The read-back this path used to do returned null for the
  // deleted row and suppressed the event by accident; nothing may depend on that.
  it('publishes nothing for a done that lands after the row is gone', () => {
    const { service, start, emitted, updates } = makeService();
    const { item, finish } = makeItem();
    const id = start(item);

    service.remove(id);
    emitted.length = 0;
    updates.length = 0;
    finish('cancelled');

    expect(emitted).toEqual([]);
    expect(updates).toEqual([]);
  });
});

describe('DownloadsService — controls on a live download', () => {
  it('pauses and cancels through the live item', () => {
    const { service, start } = makeService();
    const { item } = makeItem();
    const id = start(item);

    service.pause(id);
    expect(item.pause).toHaveBeenCalledOnce();
    service.cancel(id);
    expect(item.cancel).toHaveBeenCalledOnce();
  });

  // Previously `if (live?.item.canResume()) live.item.resume()` — a download the
  // server will not restart silently did nothing at all.
  it('throws rather than silently declining to resume what cannot be resumed', () => {
    const { service, start } = makeService();
    const { item } = makeItem({ canResume: false });
    const id = start(item);

    expect(() => service.resume(id)).toThrow('This download cannot be resumed');
    expect(item.resume).not.toHaveBeenCalled();
  });

  it('resumes when the transfer can be restarted', () => {
    const { service, start } = makeService();
    const { item } = makeItem();
    const id = start(item);

    service.resume(id);
    expect(item.resume).toHaveBeenCalledOnce();
  });
});

// The other half of the defect: nothing reconciled rows the last run left
// behind, so a download interrupted by quitting stayed `in_progress` forever —
// `isActive()` kept it in the active list behind a frozen progress bar.
describe('DownloadsService.reconcileInterrupted', () => {
  it('reports how many transfers the last run left behind', () => {
    const { service, infos } = makeService({ orphans: 3 });
    service.reconcileInterrupted();
    expect(infos[0]).toContain('3');
  });

  it('says nothing on a clean boot', () => {
    const { service, infos, warnings } = makeService({ orphans: 0 });
    service.reconcileInterrupted();
    expect(infos).toEqual([]);
    expect(warnings).toEqual([]);
  });

  // It runs from `bootstrap()`; housekeeping must never stop the browser opening.
  it('survives a failing database rather than taking the boot down with it', () => {
    const { service, warnings } = makeService();
    expect(() => service.reconcileInterrupted()).not.toThrow();
    expect(warnings[0]).toContain('reconcile');
  });
});

// The defect: `item.on('updated')` was unthrottled and the `elapsed >= 1` guard
// gated only the speed sample, so every tick ran a synchronous UPDATE plus a
// SELECT read-back on the main process. `LIMITS.downloadSampleMs` documented the
// intended window and was referenced nowhere.
describe('DownloadsService — progress persistence', () => {
  it('writes at most once per sampling window, however fast the ticks arrive', () => {
    const { start, updates } = makeService();
    const { item, tick } = makeItem();
    start(item);

    tick(1_000);
    tick(2_000);
    tick(3_000);
    expect(updates).toHaveLength(1);

    vi.advanceTimersByTime(LIMITS.downloadSampleMs);
    expect(updates).toHaveLength(2);
  });

  // `throttle`'s trailing call carries the arguments of the call that
  // *scheduled* it, so the item has to be read when the tick fires.
  it('publishes the newest bytes, not the ones that scheduled the tick', () => {
    const { start, updates } = makeService();
    const { item, tick } = makeItem();
    start(item);

    tick(1_000);
    tick(2_000);
    tick(3_000);
    vi.advanceTimersByTime(LIMITS.downloadSampleMs);

    expect(updates.at(-1)?.patch.receivedBytes).toBe(3_000);
  });

  it('never reads back the row it just wrote', () => {
    const { start, reads } = makeService();
    const { item, tick } = makeItem();
    start(item);

    tick(1_000);
    vi.advanceTimersByTime(LIMITS.downloadSampleMs);
    tick(2_000);
    vi.advanceTimersByTime(LIMITS.downloadSampleMs);

    expect(reads()).toBe(0);
  });

  it('still publishes an update for every write', () => {
    const { start, emitted } = makeService();
    const { item, tick } = makeItem();
    start(item);

    tick(1_000);
    const updates = emitted.filter((event) => event.type === 'download:updated');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ download: { receivedBytes: 1_000, state: 'in_progress' } });
  });

  it('samples a speed only once a full window has passed under it', () => {
    const { start, emitted } = makeService();
    const { item, tick } = makeItem();
    start(item);

    // The leading-edge tick lands with no window behind it; a speed here would
    // be bytes divided by ~0.
    tick(1_000);
    expect(emitted.at(-1)).toMatchObject({ download: { speed: 0, etaSeconds: null } });

    // A full window later, 50_000 bytes have arrived across it.
    vi.advanceTimersByTime(LIMITS.downloadSampleMs);
    tick(50_000);
    expect(emitted.at(-1)).toMatchObject({ download: { speed: 50_000, etaSeconds: 19 } });
  });

  it('reports a paused transfer as paused', () => {
    const { service, start, states } = makeService();
    const { item, tick } = makeItem();
    const id = start(item);

    service.pause(id);
    tick(1_000);
    expect(states().at(-1)).toBe('paused');
  });
});

// The lesson `update.service.ts` already learned: a trailing tick that lands
// after the terminal state must not drag it back.
describe('DownloadsService — a tick landing after the transfer ends', () => {
  it('does not drag a completed download back to in_progress', () => {
    const { start, states } = makeService();
    const { item, tick, finish } = makeItem();
    start(item);

    tick(1_000);
    tick(2_000); // queued behind the throttle
    finish('completed');
    vi.advanceTimersByTime(LIMITS.downloadSampleMs);

    expect(states().at(-1)).toBe('completed');
  });

  // With a scan in flight the live entry outlives `done`, so the guard that has
  // to hold here is the `completedAt` stamp rather than the map lookup.
  it('does not republish while the safety scan is still running', async () => {
    const { service, start, states } = makeService({ scanDownloads: true });
    const { item, tick, finish } = makeItem();
    service.setScanner(() => new Promise<DownloadSafety>(() => {}));
    start(item);

    tick(1_000);
    tick(2_000);
    finish('completed');
    await vi.advanceTimersByTimeAsync(LIMITS.downloadSampleMs);

    expect(states().at(-1)).toBe('completed');
  });
});

/** A `SqliteDatabase` that records the SQL it is asked to prepare. */
function makeRepo() {
  const statements: string[] = [];
  const db = {
    prepare: (sql: string) => {
      statements.push(sql.replace(/\s+/g, ' ').trim());
      return { run: () => ({ changes: 2 }), all: () => [], get: () => undefined };
    },
  } as unknown as SqliteDatabase;
  return { repo: new DownloadsRepository(db), statements };
}

describe('DownloadsRepository', () => {
  // The defect: the filter listed terminal states by hand as
  // `IN ('completed', 'cancelled')` and missed `interrupted`, so a failed
  // download could be removed only one row at a time, by hand — not by "Clear
  // completed", and not by "Clear browsing data → downloads" either.
  it('clears a failed download, not just completed and cancelled ones', () => {
    const { repo, statements } = makeRepo();
    repo.clearCompleted('profile_1');

    expect(statements[0]).toContain("NOT IN ('in_progress', 'paused')");
    expect(statements[0]).not.toContain("IN ('completed', 'cancelled')");
  });

  it('spares a running transfer from the sweep', () => {
    const { repo, statements } = makeRepo();
    repo.clearCompleted('profile_1');
    expect(statements[0]).toMatch(/DELETE FROM downloads WHERE profile_id = \?/);
  });

  it('marks only live states interrupted, and reports how many', () => {
    const { repo, statements } = makeRepo();
    expect(repo.markInterrupted()).toBe(2);

    expect(statements[0]).toContain("SET state = 'interrupted'");
    expect(statements[0]).toContain("WHERE state IN ('in_progress', 'paused')");
  });

  // The row stopped at an unknown point in the previous run; stamping it with
  // the time we noticed would record a moment that never happened.
  it('leaves completed_at alone when reconciling', () => {
    const { repo, statements } = makeRepo();
    repo.markInterrupted();
    expect(statements[0]).not.toContain('completed_at');
  });
});
