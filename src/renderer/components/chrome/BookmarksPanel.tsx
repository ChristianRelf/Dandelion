import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import type { Bookmark, BookmarkFolder } from '@shared/types';
import { prettifyUrl } from '@shared/utils';
import { cn } from '../../lib/cn';
import { Favicon } from '../ui/Favicon';
import { SearchField } from '../ui/SearchField';
import { Skeleton } from '../ui/Skeleton';
import { trpc } from '../../lib/trpc/client';
import { openUrlOrToast } from '../../lib/navigation';
import { useBrowserStore } from '../../stores/browser.store';
import { useAsyncData } from '../../hooks/useAsyncData';

/** Bookmarks with no folder are shown last, under this heading. */
const UNFILED = '__unfiled__';

function BookmarkRow({
  bookmark,
  onOpen,
}: {
  bookmark: Bookmark;
  onOpen: () => void;
}): ReactElement {
  const label = bookmark.title.trim() || prettifyUrl(bookmark.url);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${label}\n${bookmark.url}`}
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-muted transition-colors duration-[var(--duration-fast)] hover:bg-surface-hover hover:text-text active:scale-[0.99]"
    >
      <Favicon src={bookmark.favicon} className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function FolderSection({
  name,
  bookmarks,
  onOpen,
}: {
  name: string;
  bookmarks: Bookmark[];
  onOpen: (bookmark: Bookmark) => void;
}): ReactElement {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-7 items-center gap-1 rounded-md px-1 text-[11px] font-semibold tracking-wide text-faint uppercase transition-colors hover:text-muted"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 transition-transform duration-[var(--duration-fast)]',
            open && 'rotate-90',
          )}
        />
        <Folder className="h-3 w-3" />
        <span className="truncate">{name}</span>
        <span className="ml-auto tabular-nums">{bookmarks.length}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 pl-2">
          {bookmarks.map((bookmark) => (
            <BookmarkRow key={bookmark.id} bookmark={bookmark} onOpen={() => onOpen(bookmark)} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The sidebar's bookmarks panel: search, folder sections, one click to open in
 * the active tab. The full manager stays a page — this is for quick access.
 */
export function BookmarksPanel(): ReactElement {
  const profileId = useBrowserStore((state) => state.profile?.id);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    status,
    data: bookmarks,
    reload,
  } = useAsyncData<Bookmark[]>(
    () =>
      profileId
        ? trpc.bookmarks.list.query({ profileId, query: debounced || undefined })
        : Promise.resolve([]),
    [profileId, debounced],
    [],
  );

  const { data: folders } = useAsyncData<BookmarkFolder[]>(
    () => (profileId ? trpc.bookmarks.listFolders.query({ profileId }) : Promise.resolve([])),
    [profileId],
    [],
  );

  const sections = useMemo(() => {
    const names = new Map(folders.map((folder) => [folder.id, folder.name]));
    const byFolder = new Map<string, Bookmark[]>();
    for (const bookmark of bookmarks) {
      const key = bookmark.folderId ?? UNFILED;
      const list = byFolder.get(key) ?? [];
      list.push(bookmark);
      byFolder.set(key, list);
    }
    // Named folders first, in the order the profile defines; unfiled last.
    const ordered = folders
      .filter((folder) => byFolder.has(folder.id))
      .map((folder) => ({
        key: folder.id,
        name: names.get(folder.id) ?? 'Folder',
        items: byFolder.get(folder.id)!,
      }));
    const unfiled = byFolder.get(UNFILED);
    return { ordered, unfiled: unfiled ?? [] };
  }, [bookmarks, folders]);

  const open = (bookmark: Bookmark): void =>
    openUrlOrToast(bookmark.url, 'Failed to open bookmark');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-1">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search bookmarks"
        aria-label="Search bookmarks"
      />

      <div className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1">
        {status === 'loading' && bookmarks.length === 0 ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex h-8 items-center gap-2 px-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))
        ) : status === 'error' ? (
          // `useAsyncData` returns `data: []` on rejection, so without this a
          // failed query renders "No bookmarks yet" to someone who has some.
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <p className="text-[12px] text-faint">Couldn’t load bookmarks</p>
            <button
              type="button"
              onClick={reload}
              className="rounded px-2 py-1 text-[12px] text-accent hover:bg-surface-hover"
            >
              Retry
            </button>
          </div>
        ) : bookmarks.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-faint">
            {query.trim() ? 'No bookmarks matched' : 'No bookmarks yet'}
          </p>
        ) : (
          <>
            {sections.ordered.map((section) => (
              <FolderSection
                key={section.key}
                name={section.name}
                bookmarks={section.items}
                onOpen={open}
              />
            ))}
            {sections.unfiled.map((bookmark) => (
              <BookmarkRow key={bookmark.id} bookmark={bookmark} onOpen={() => open(bookmark)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
