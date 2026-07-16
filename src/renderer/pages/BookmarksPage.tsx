import { useEffect, useState, type ReactElement } from 'react';
import { Bookmark as BookmarkIcon, Trash2 } from 'lucide-react';
import type { Bookmark } from '@shared/types';
import { getHostname, prettifyUrl } from '@shared/utils';
import { PageShell } from './PageShell';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { EmptyState } from '../components/ui/EmptyState';
import { SearchField } from '../components/ui/SearchField';
import { ListContainer, ListRow } from '../components/ui/List';
import { IconTile } from '../components/ui/IconTile';
import { Skeleton } from '../components/ui/Skeleton';
import { Favicon } from '../components/ui/Favicon';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { useAsyncData } from '../hooks/useAsyncData';
import { toast } from '../stores/toast.store';

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
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
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </ListContainer>
  );
}

export function BookmarksPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    status,
    data: bookmarks,
    error,
    reload,
  } = useAsyncData<Bookmark[]>(
    () =>
      profile
        ? trpc.bookmarks.list.query({ profileId: profile.id, query: debounced || undefined })
        : Promise.resolve([]),
    [profile?.id, debounced],
    [],
  );

  const open = (url: string): void => {
    const { activeTabId } = useBrowserStore.getState();
    if (activeTabId) {
      void trpc.tabs.navigate
        .mutate({ tabId: activeTabId, url })
        .catch(() => toast.error('Failed to open page'));
    }
  };

  const remove = (bookmark: Bookmark): void => {
    void trpc.bookmarks.remove
      .mutate({ bookmarkId: bookmark.id })
      .then(() => reload())
      .catch(() => toast.error('Failed to remove bookmark'));
  };

  const exportBookmarks = async (): Promise<void> => {
    if (!profile) return;
    setExporting(true);
    try {
      const html = await trpc.bookmarks.export.query({ profileId: profile.id });
      const count = (html.match(/<a\s+href=/gi) ?? []).length;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'dandelion-bookmarks.html';
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${plural(count, 'bookmark')}`);
    } catch (caught) {
      toast.error('Failed to export bookmarks', { description: messageOf(caught) });
    } finally {
      setExporting(false);
    }
  };

  const importBookmarks = (): void => {
    if (!profile) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,text/html';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const html = await file.text();
        const { imported } = await trpc.bookmarks.import.mutate({ profileId: profile.id, html });
        toast.success(`Imported ${plural(imported, 'bookmark')}`);
        reload();
      } catch (caught) {
        toast.error('Failed to import bookmarks', { description: messageOf(caught) });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  function renderBody(): ReactElement {
    if (status === 'loading' && bookmarks.length === 0) return <LoadingRows />;
    if (status === 'error') {
      return (
        <EmptyState
          icon="triangle-alert"
          title="Couldn't load bookmarks"
          description={error ?? undefined}
          action={
            <Button icon="rotate-cw" onClick={reload}>
              Retry
            </Button>
          }
        />
      );
    }
    if (bookmarks.length === 0) {
      return query.trim() ? (
        <EmptyState
          icon="search"
          title="No results"
          description={`No bookmarks matched "${query.trim()}".`}
        />
      ) : (
        <EmptyState
          icon="bookmark"
          title="No bookmarks yet"
          description="Press ⌘D on any page to save it here."
        />
      );
    }

    return (
      <ListContainer>
        {bookmarks.map((bookmark) => {
          const hasTitle = Boolean(bookmark.title.trim());
          const primary = hasTitle ? bookmark.title : prettifyUrl(bookmark.url);
          return (
            <ListRow
              key={bookmark.id}
              leading={
                <IconTile size="sm">
                  <Favicon src={bookmark.favicon} className="h-4 w-4" />
                </IconTile>
              }
              title={primary}
              subtitle={hasTitle ? prettifyUrl(bookmark.url) : getHostname(bookmark.url)}
              onActivate={() => open(bookmark.url)}
              actions={
                <IconButton
                  size="sm"
                  aria-label={`Remove ${primary}`}
                  onClick={() => remove(bookmark)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              }
            />
          );
        })}
      </ListContainer>
    );
  }

  return (
    <PageShell
      title="Bookmarks"
      description="Everything you've saved."
      icon={<BookmarkIcon className="h-5 w-5" />}
      actions={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="upload"
            loading={importing}
            onClick={importBookmarks}
          >
            Import
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            loading={exporting}
            onClick={() => void exportBookmarks()}
          >
            Export
          </Button>
        </div>
      }
    >
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search bookmarks"
        aria-label="Search bookmarks"
        className="mb-5"
      />

      {renderBody()}
    </PageShell>
  );
}
