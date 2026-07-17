import { describe, expect, it } from 'vitest';
import { HistoryService } from '@main/services/history.service';
import { LIMITS } from '@shared/constants';
import type { Repositories } from '@main/storage';

const DAY = 86_400_000;

/** Records the cutoff `prune` asks for, which is the whole decision. */
function makeService(deleted = 0) {
  const calls: Array<{ profileId: string; cutoff: number }> = [];
  const repos = {
    history: {
      pruneOlderThan: (profileId: string, cutoff: number) => {
        calls.push({ profileId, cutoff });
        return deleted;
      },
    },
  } as unknown as Repositories;
  return { service: new HistoryService(repos), calls };
}

describe('HistoryService.prune', () => {
  // The defect was not this function — it was correct, and nothing ever called
  // it, so `LIMITS.historyRetentionDays` was a policy the browser documented and
  // did not enforce. `AppContext.bootstrap` now calls it per profile.
  it('cuts off exactly the configured retention window', () => {
    const { service, calls } = makeService();
    const before = Date.now();
    service.prune('profile_1');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.profileId).toBe('profile_1');
    // The cutoff is retentionDays ago, within the tick this test took to run.
    const expected = before - LIMITS.historyRetentionDays * DAY;
    expect(calls[0]!.cutoff).toBeGreaterThanOrEqual(expected);
    expect(calls[0]!.cutoff).toBeLessThanOrEqual(expected + 5_000);
  });

  it('reports how many entries went, so the caller can log it', () => {
    const { service } = makeService(12);
    expect(service.prune('profile_1')).toBe(12);
  });

  it('keeps everything, and touches nothing, when retention is disabled', () => {
    const { service, calls } = makeService();
    const original = LIMITS.historyRetentionDays;
    try {
      // `0 = keep forever`, per the constant's own documentation.
      (LIMITS as { historyRetentionDays: number }).historyRetentionDays = 0;
      expect(service.prune('profile_1')).toBe(0);
      expect(calls).toHaveLength(0);
    } finally {
      (LIMITS as { historyRetentionDays: number }).historyRetentionDays = original;
    }
  });
});
