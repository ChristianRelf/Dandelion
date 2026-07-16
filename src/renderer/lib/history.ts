import { endOfDay, format, isToday, isYesterday, startOfDay } from 'date-fns';
import type { HistoryEntry } from '@shared/types';

/**
 * A day's worth of history. `from`/`to` bound the same day the rows are grouped
 * by, so deleting the range removes exactly what the group displays.
 */
export interface DayGroup {
  label: string;
  from: number;
  to: number;
  items: HistoryEntry[];
}

/** Day heading: the two most recent days read better by name than by date. */
export function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, d MMMM');
}

/**
 * Bucket entries into local calendar days, newest day first. Entries keep the
 * order they arrived in, which is the newest-first order the search returns.
 */
export function groupByDay(entries: HistoryEntry[]): DayGroup[] {
  const days = new Map<number, DayGroup>();
  for (const entry of entries) {
    const day = startOfDay(new Date(entry.lastVisitedAt));
    const from = day.getTime();
    let group = days.get(from);
    if (!group) {
      group = {
        label: dayLabel(entry.lastVisitedAt),
        from,
        to: endOfDay(day).getTime(),
        items: [],
      };
      days.set(from, group);
    }
    group.items.push(entry);
  }
  return [...days.values()].sort((a, b) => b.from - a.from);
}
