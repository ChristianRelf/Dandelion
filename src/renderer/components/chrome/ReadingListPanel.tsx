import { type ReactElement } from 'react';
import { BookOpen, Check, CircleDot, Plus, Trash2 } from 'lucide-react';
import type { ReadingItem, Tab } from '@shared/types';
import { prettifyUrl } from '@shared/utils';
import { cn } from '../../lib/cn';
import { Favicon } from '../ui/Favicon';
import { IconButton } from '../ui/IconButton';
import { Skeleton } from '../ui/Skeleton';
import { trpc } from '../../lib/trpc/client';
import { openUrl } from '../../lib/navigation';
import { useBrowserStore } from '../../stores/browser.store';
import { useAsyncData } from '../../hooks/useAsyncData';
import { toast } from '../../stores/toast.store';

function ReadingRow({
  item,
  onOpen,
  onToggleRead,
  onRemove,
}: {
  item: ReadingItem;
  onOpen: () => void;
  onToggleRead: () => void;
  onRemove: () => void;
}): ReactElement {
  const label = item.title.trim() || prettifyUrl(item.url);
  return (
    <div className="group/row flex items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        title={`${label}\n${item.url}`}
        className={cn(
          'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px] transition-colors duration-[var(--duration-fast)] hover:bg-surface-hover active:scale-[0.99]',
          item.read ? 'text-faint' : 'text-muted hover:text-text',
        )}
      >
        <Favicon src={item.favicon} className={cn('h-4 w-4 shrink-0', item.read && 'opacity-60')} />
        <span className={cn('truncate', item.read && 'line-through')}>{label}</span>
      </button>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
        <IconButton
          size="sm"
          aria-label={item.read ? `Mark ${label} unread` : `Mark ${label} read`}
          onClick={onToggleRead}
        >
          {item.read ? <CircleDot className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </IconButton>
        <IconButton size="sm" aria-label={`Remove ${label}`} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

/**
 * The sidebar's reading list: pages saved to read later. "Save this page" queues
 * the active tab; opening an item marks it read (Safari's behaviour), and a
 * one-press toggle puts it back. Unread float to the top.
 */
export function ReadingListPanel(): ReactElement {
  const profileId = useBrowserStore((state) => state.profile?.id);
  const activeTab = useBrowserStore((state): Tab | null =>
    state.activeTabId ? (state.tabs[state.activeTabId] ?? null) : null,
  );
  const canSave = Boolean(activeTab && /^https?:/i.test(activeTab.url));

  const {
    status,
    data: items,
    reload,
  } = useAsyncData<ReadingItem[]>(
    () => (profileId ? trpc.readingList.list.query({ profileId }) : Promise.resolve([])),
    [profileId],
    [],
  );

  const save = (): void => {
    if (!profileId || !activeTab) return;
    void trpc.readingList.add
      .mutate({
        profileId,
        url: activeTab.url,
        title: activeTab.title,
        favicon: activeTab.favicon,
      })
      .then(() => reload())
      .catch(() => toast.error('Failed to save page'));
  };

  const open = (item: ReadingItem): void => {
    void openUrl(item.url)
      .then(() => {
        if (!item.read) return trpc.readingList.setRead.mutate({ id: item.id, read: true });
        return undefined;
      })
      .then(() => reload())
      .catch(() => toast.error('Failed to open page'));
  };

  const toggleRead = (item: ReadingItem): void => {
    void trpc.readingList.setRead
      .mutate({ id: item.id, read: !item.read })
      .then(() => reload())
      .catch(() => toast.error('Failed to update reading list'));
  };

  const remove = (item: ReadingItem): void => {
    void trpc.readingList.remove
      .mutate({ id: item.id })
      .then(() => reload())
      .catch(() => toast.error('Failed to remove item'));
  };

  const clearRead = (): void => {
    if (!profileId) return;
    void trpc.readingList.clearRead
      .mutate({ profileId })
      .then(() => reload())
      .catch(() => toast.error('Failed to clear read items'));
  };

  const hasRead = items.some((item) => item.read);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-1">
      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-[12px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Save this page
      </button>

      <div className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1">
        {status === 'loading' && items.length === 0 ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex h-8 items-center gap-2 px-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <p className="text-[12px] text-faint">Couldn’t load your reading list</p>
            <button
              type="button"
              onClick={reload}
              className="rounded px-2 py-1 text-[12px] text-accent hover:bg-surface-hover"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-faint">
            <BookOpen className="h-6 w-6" />
            <p className="text-[12px]">Nothing saved to read later yet.</p>
          </div>
        ) : (
          <>
            {items.map((item) => (
              <ReadingRow
                key={item.id}
                item={item}
                onOpen={() => open(item)}
                onToggleRead={() => toggleRead(item)}
                onRemove={() => remove(item)}
              />
            ))}
          </>
        )}
      </div>

      {hasRead && (
        <button
          type="button"
          onClick={clearRead}
          className="mb-1 h-7 rounded-md text-[12px] text-faint transition-colors hover:bg-surface-hover hover:text-muted"
        >
          Clear read
        </button>
      )}
    </div>
  );
}
