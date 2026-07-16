import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import type { HistoryEntry } from '@shared/types';
import { prettifyUrl } from '@shared/utils';
import { groupByDay } from '../../lib/history';
import { Favicon } from '../ui/Favicon';
import { SearchField } from '../ui/SearchField';
import { Skeleton } from '../ui/Skeleton';
import { trpc } from '../../lib/trpc/client';
import { useBrowserStore } from '../../stores/browser.store';
import { useAsyncData } from '../../hooks/useAsyncData';
import { openUrlOrToast } from '../../lib/navigation';

/** Recent pages only — the full timeline stays on the history page. */
const PANEL_LIMIT = 100;

function HistoryRow({ entry }: { entry: HistoryEntry }): ReactElement {
  const label = entry.title.trim() || prettifyUrl(entry.url);
  return (
    <button
      type="button"
      onClick={() => openUrlOrToast(entry.url, 'Failed to open page')}
      title={`${label}\n${entry.url}`}
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-muted transition-colors duration-[var(--duration-fast)] hover:bg-surface-hover hover:text-text active:scale-[0.99]"
    >
      <Favicon src={entry.favicon} className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 text-[11px] text-faint tabular-nums">
        {format(new Date(entry.lastVisitedAt), 'HH:mm')}
      </span>
    </button>
  );
}

/**
 * The sidebar's history panel: search and recent pages grouped by day, one
 * click to open in the active tab. The full page owns deletion and clearing.
 */
export function HistoryPanel(): ReactElement {
  const profileId = useBrowserStore((state) => state.profile?.id);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const { status, data: entries } = useAsyncData<HistoryEntry[]>(
    () =>
      profileId
        ? trpc.history.search.query({ profileId, query: debounced, limit: PANEL_LIMIT })
        : Promise.resolve([]),
    [profileId, debounced],
    [],
  );

  const groups = useMemo(() => groupByDay(entries), [entries]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-1">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search history"
        aria-label="Search history"
      />

      <div className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1">
        {status === 'loading' && entries.length === 0 ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex h-8 items-center gap-2 px-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))
        ) : entries.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-faint">
            {query.trim() ? 'Nothing matched' : 'No history yet'}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.from} className="flex flex-col">
              <h3 className="px-1 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
                {group.label}
              </h3>
              {group.items.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
