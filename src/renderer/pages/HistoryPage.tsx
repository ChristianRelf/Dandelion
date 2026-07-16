import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { History, Search, Trash2, X } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import type { HistoryEntry } from '@shared/types';
import { getHostname, prettifyUrl } from '@shared/utils';
import { PageShell } from './PageShell';
import { Favicon } from '../components/ui/Favicon';
import { IconButton } from '../components/ui/IconButton';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';

function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, d MMMM');
}

export function HistoryPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const load = useCallback(() => {
    if (profile) {
      void trpc.history.search
        .query({ profileId: profile.id, query, limit: 400, offset: 0 })
        .then(setEntries);
    }
  }, [profile, query]);

  useEffect(() => {
    const timer = setTimeout(load, 150);
    return () => clearTimeout(timer);
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of entries) {
      const label = dayLabel(entry.lastVisitedAt);
      const list = map.get(label) ?? [];
      list.push(entry);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [entries]);

  const remove = (entry: HistoryEntry): void => {
    if (!profile) return;
    void trpc.history.delete.mutate({ profileId: profile.id, entryIds: [entry.id] }).then(load);
  };

  const openUrl = (url: string): void => {
    const { activeTabId } = useBrowserStore.getState();
    if (activeTabId) void trpc.tabs.navigate.mutate({ tabId: activeTabId, url });
  };

  return (
    <PageShell
      title="History"
      description="Everything you've visited, grouped by day."
      icon={<History className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={() =>
            profile && void trpc.history.clear.mutate({ profileId: profile.id }).then(load)
          }
          className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Trash2 className="h-4 w-4" /> Clear all
        </button>
      }
    >
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
        <Search className="h-4 w-4 text-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search history"
          className="flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-faint"
        />
      </div>

      {groups.length === 0 && (
        <p className="py-16 text-center text-sm text-faint">No history yet.</p>
      )}

      {groups.map(([label, items]) => (
        <section key={label} className="mb-6">
          <h2 className="mb-2 text-[11px] font-medium tracking-wide text-faint uppercase">
            {label}
          </h2>
          <div className="overflow-hidden rounded-xl border border-line">
            {items.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-hover"
              >
                <span className="w-12 shrink-0 text-xs text-faint tabular-nums">
                  {format(new Date(entry.lastVisitedAt), 'HH:mm')}
                </span>
                <Favicon src={entry.favicon} className="h-4 w-4 shrink-0" />
                <button
                  type="button"
                  onClick={() => openUrl(entry.url)}
                  className="min-w-0 flex-1 truncate text-left text-[13.5px] text-text"
                >
                  {entry.title || prettifyUrl(entry.url)}
                </button>
                <span className="hidden max-w-56 shrink-0 truncate text-xs text-faint sm:block">
                  {getHostname(entry.url)}
                </span>
                <IconButton
                  size="sm"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => remove(entry)}
                >
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
          </div>
        </section>
      ))}
    </PageShell>
  );
}
