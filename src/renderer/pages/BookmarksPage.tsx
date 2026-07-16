import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Bookmark as BookmarkIcon, Download, Search, Upload, X } from 'lucide-react';
import type { Bookmark } from '@shared/types';
import { getHostname, prettifyUrl } from '@shared/utils';
import { PageShell } from './PageShell';
import { Favicon } from '../components/ui/Favicon';
import { IconButton } from '../components/ui/IconButton';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';

export function BookmarksPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const [query, setQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const load = useCallback(() => {
    if (profile) {
      void trpc.bookmarks.list
        .query({ profileId: profile.id, query: query || undefined })
        .then(setBookmarks);
    }
  }, [profile, query]);

  useEffect(() => {
    const timer = setTimeout(load, 150);
    return () => clearTimeout(timer);
  }, [load]);

  const exportBookmarks = async (): Promise<void> => {
    if (!profile) return;
    const html = await trpc.bookmarks.export.query({ profileId: profile.id });
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'dandelion-bookmarks.html';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBookmarks = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !profile) return;
      const html = await file.text();
      await trpc.bookmarks.import.mutate({ profileId: profile.id, html });
      load();
    };
    input.click();
  };

  const open = (url: string): void => {
    const { activeTabId } = useBrowserStore.getState();
    if (activeTabId) void trpc.tabs.navigate.mutate({ tabId: activeTabId, url });
  };

  return (
    <PageShell
      title="Bookmarks"
      description="Everything you've saved."
      icon={<BookmarkIcon className="h-5 w-5" />}
      actions={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={importBookmarks}
            className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            type="button"
            onClick={() => void exportBookmarks()}
            className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      }
    >
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
        <Search className="h-4 w-4 text-faint" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search bookmarks"
          className="flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-faint"
        />
      </div>

      {bookmarks.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">
          No bookmarks yet — press ⌘D on any page.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          {bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="group flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-surface-hover"
            >
              <Favicon src={bookmark.favicon} className="h-4 w-4 shrink-0" />
              <button
                type="button"
                onClick={() => open(bookmark.url)}
                className="min-w-0 flex-1 truncate text-left text-[13.5px] text-text"
              >
                {bookmark.title || prettifyUrl(bookmark.url)}
              </button>
              <span className="hidden max-w-56 shrink-0 truncate text-xs text-faint sm:block">
                {getHostname(bookmark.url)}
              </span>
              <IconButton
                size="sm"
                className="opacity-0 group-hover:opacity-100"
                onClick={() =>
                  void trpc.bookmarks.remove.mutate({ bookmarkId: bookmark.id }).then(load)
                }
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
