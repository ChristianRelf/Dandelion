import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { History, Trash2 } from 'lucide-react';
import { endOfDay, format, isToday, isYesterday, startOfDay } from 'date-fns';
import type { HistoryEntry } from '@shared/types';
import { getHostname, prettifyUrl } from '@shared/utils';
import { PageShell } from './PageShell';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { EmptyState } from '../components/ui/EmptyState';
import { SearchField } from '../components/ui/SearchField';
import { ListContainer, ListRow } from '../components/ui/List';
import { IconTile } from '../components/ui/IconTile';
import { Skeleton } from '../components/ui/Skeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Favicon } from '../components/ui/Favicon';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { useAsyncData } from '../hooks/useAsyncData';
import { toast } from '../stores/toast.store';

function dayLabel(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, d MMMM');
}

/**
 * A day's worth of history. `from`/`to` bound the same day the rows are grouped
 * by, so deleting the range removes exactly what the group displays.
 */
interface DayGroup {
  label: string;
  from: number;
  to: number;
  items: HistoryEntry[];
}

/** Skeleton placeholders shown during the first load. */
function LoadingRows(): ReactElement {
  return (
    <ListContainer>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-3"
          style={{ paddingBlock: 'var(--row-py)' }}
        >
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </ListContainer>
  );
}

export function HistoryPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dayToDelete, setDayToDelete] = useState<DayGroup | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    status,
    data: entries,
    error,
    reload,
  } = useAsyncData<HistoryEntry[]>(
    () =>
      profile
        ? trpc.history.search.query({ profileId: profile.id, query: debounced, limit: 200 })
        : Promise.resolve([]),
    [profile?.id, debounced],
    [],
  );

  const groups = useMemo(() => {
    const map = new Map<number, DayGroup>();
    for (const entry of entries) {
      const day = startOfDay(new Date(entry.lastVisitedAt));
      const from = day.getTime();
      let group = map.get(from);
      if (!group) {
        group = {
          label: dayLabel(entry.lastVisitedAt),
          from,
          to: endOfDay(day).getTime(),
          items: [],
        };
        map.set(from, group);
      }
      group.items.push(entry);
    }
    return [...map.values()].sort((a, b) => b.from - a.from);
  }, [entries]);

  const openUrl = (url: string): void => {
    const { activeTabId } = useBrowserStore.getState();
    if (activeTabId) {
      void trpc.tabs.navigate
        .mutate({ tabId: activeTabId, url })
        .catch(() => toast.error('Failed to open page'));
    }
  };

  const remove = (entry: HistoryEntry): void => {
    if (!profile) return;
    void trpc.history.delete
      .mutate({ profileId: profile.id, entryIds: [entry.id] })
      .then(() => reload())
      .catch(() => toast.error('Failed to remove history entry'));
  };

  const clearAll = (): void => {
    if (!profile) return;
    void trpc.history.clear
      .mutate({ profileId: profile.id })
      .then(() => {
        toast.success('History cleared');
        reload();
      })
      .catch(() => toast.error('Failed to clear history'));
  };

  const deleteDay = (group: DayGroup): void => {
    if (!profile) return;
    const count = group.items.length;
    void trpc.history.delete
      .mutate({ profileId: profile.id, from: group.from, to: group.to })
      .then(() => {
        toast.success(`Cleared ${group.label.toLowerCase()}`, {
          description: `${count} ${count === 1 ? 'page' : 'pages'} removed`,
        });
        reload();
      })
      .catch(() => toast.error(`Failed to clear ${group.label.toLowerCase()}`));
  };

  function renderBody(): ReactElement {
    if (status === 'loading' && entries.length === 0) return <LoadingRows />;
    if (status === 'error') {
      return (
        <EmptyState
          icon="triangle-alert"
          title="Couldn't load history"
          description={error ?? undefined}
          action={
            <Button icon="rotate-cw" onClick={reload}>
              Retry
            </Button>
          }
        />
      );
    }
    if (entries.length === 0) {
      return query.trim() ? (
        <EmptyState
          icon="search"
          title="No results"
          description={`Nothing in your history matched "${query.trim()}".`}
        />
      ) : (
        <EmptyState
          icon="history"
          title="No history yet"
          description="Pages you visit will show up here, grouped by day."
        />
      );
    }

    return (
      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.from}>
            <div className="group sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 bg-bg/85 py-2 backdrop-blur-sm">
              <h2 className="text-[11px] font-semibold tracking-wider text-faint uppercase">
                {group.label}
              </h2>
              <IconButton
                size="sm"
                aria-label={`Delete all history from ${group.label}`}
                className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => setDayToDelete(group)}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
            <ListContainer>
              {group.items.map((entry) => {
                const hasTitle = Boolean(entry.title.trim());
                const primary = hasTitle ? entry.title : prettifyUrl(entry.url);
                return (
                  <ListRow
                    key={entry.id}
                    leading={
                      <IconTile size="sm">
                        <Favicon src={entry.favicon} className="h-4 w-4" />
                      </IconTile>
                    }
                    title={primary}
                    subtitle={hasTitle ? prettifyUrl(entry.url) : getHostname(entry.url)}
                    meta={format(new Date(entry.lastVisitedAt), 'HH:mm')}
                    onActivate={() => openUrl(entry.url)}
                    actions={
                      <IconButton
                        size="sm"
                        aria-label={`Remove ${primary} from history`}
                        onClick={() => remove(entry)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    }
                  />
                );
              })}
            </ListContainer>
          </section>
        ))}
      </div>
    );
  }

  return (
    <PageShell
      title="History"
      description="Everything you've visited, grouped by day."
      icon={<History className="h-5 w-5" />}
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon="trash-2"
          disabled={status !== 'ready' || entries.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Clear all
        </Button>
      }
    >
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search history"
        aria-label="Search history"
        className="mb-5"
      />

      {renderBody()}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear all history?"
        description="This permanently removes every page from your browsing history. This can't be undone."
        confirmLabel="Clear history"
        destructive
        onConfirm={clearAll}
      />

      <ConfirmDialog
        open={dayToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setDayToDelete(null);
        }}
        title={`Clear ${dayToDelete?.label.toLowerCase() ?? 'this day'}?`}
        description={
          dayToDelete
            ? `This permanently removes ${dayToDelete.items.length} ${
                dayToDelete.items.length === 1 ? 'page' : 'pages'
              } visited ${dayToDelete.label.toLowerCase()}. This can't be undone.`
            : ''
        }
        confirmLabel="Clear day"
        destructive
        onConfirm={() => {
          if (dayToDelete) deleteDay(dayToDelete);
          setDayToDelete(null);
        }}
      />
    </PageShell>
  );
}
