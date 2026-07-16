import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@shared/types';
import { groupByDay } from '@renderer/lib/history';

/** Local wall-clock times, so grouping is asserted in the user's own days. */
function entry(id: string, localTime: string): HistoryEntry {
  return {
    id,
    profileId: 'profile-1',
    url: `https://example.com/${id}`,
    title: id,
    favicon: null,
    visitCount: 1,
    lastVisitedAt: new Date(localTime).getTime(),
  } as HistoryEntry;
}

describe('groupByDay', () => {
  it('buckets entries from the same day together', () => {
    const groups = groupByDay([
      entry('a', '2026-03-10T09:00:00'),
      entry('b', '2026-03-10T21:30:00'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('separates days and orders the newest day first', () => {
    const groups = groupByDay([
      entry('older', '2026-03-08T12:00:00'),
      entry('newer', '2026-03-10T12:00:00'),
    ]);

    expect(groups.map((group) => group.items[0]!.id)).toEqual(['newer', 'older']);
  });

  it('preserves the order entries arrived in within a day', () => {
    const groups = groupByDay([
      entry('first', '2026-03-10T18:00:00'),
      entry('second', '2026-03-10T08:00:00'),
    ]);

    expect(groups[0]!.items.map((item) => item.id)).toEqual(['first', 'second']);
  });

  it('bounds each group by its own calendar day, so a range delete cannot spill', () => {
    const [group] = groupByDay([entry('a', '2026-03-10T13:45:00')]);

    expect(new Date(group!.from).getHours()).toBe(0);
    expect(new Date(group!.from).getDate()).toBe(10);
    expect(new Date(group!.to).getDate()).toBe(10);
    expect(group!.to - group!.from).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it('splits entries either side of local midnight', () => {
    const groups = groupByDay([
      entry('just-after', '2026-03-10T00:05:00'),
      entry('just-before', '2026-03-09T23:55:00'),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('returns nothing for no history', () => {
    expect(groupByDay([])).toEqual([]);
  });
});
