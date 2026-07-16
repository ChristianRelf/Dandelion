import { useEffect, useState, type ReactElement } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Columns2,
  Command,
  Download,
  RotateCw,
  X,
} from 'lucide-react';
import { isInternalUrl } from '@shared/constants';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { AddressPill } from './AddressPill';
import { ZoomControl } from './ZoomControl';
import { useActiveTab } from '../../hooks/useBrowser';
import { useBrowserStore } from '../../stores/browser.store';
import { useReaderStore } from '../../stores/reader.store';
import { useUiStore } from '../../stores/ui.store';
import { trpc } from '../../lib/trpc/client';
import { dispatchCommand } from '../../lib/commands';
import { useDownloadsStore, selectActiveDownloadCount } from '../../stores/downloads.store';

/** The navigation + address + actions row above the content area. */
export function Toolbar(): ReactElement {
  const tab = useActiveTab();
  const profileId = useBrowserStore((state) => state.profile?.id);
  const readerTabId = useReaderStore((state) => state.tabId);
  const splitActive = useUiStore((state) => state.splitTabIds.length >= 2);
  const loading = tab?.status === 'loading';
  const activeDownloads = useDownloadsStore(selectActiveDownloadCount);
  const [bookmarked, setBookmarked] = useState(false);

  const canBookmark = !!tab && !!tab.url && !isInternalUrl(tab.url);
  const readerActive = !!tab && readerTabId === tab.id;

  useEffect(() => {
    if (!profileId || !canBookmark || !tab) {
      setBookmarked(false);
      return;
    }
    let cancelled = false;
    void trpc.bookmarks.isBookmarked
      .query({ profileId, url: tab.url })
      .then((result) => !cancelled && setBookmarked(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profileId, canBookmark, tab, tab?.url]);

  return (
    <div className="flex h-[var(--toolbar-height)] shrink-0 items-center gap-1 px-2 drag">
      <div className="no-drag flex items-center gap-0.5">
        <Tooltip content="Back" shortcut="⌥←">
          <IconButton
            aria-label="Go back"
            disabled={!tab?.navigation.canGoBack}
            onClick={() => tab && void trpc.tabs.goToOffset.mutate({ tabId: tab.id, offset: -1 })}
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Forward" shortcut="⌥→">
          <IconButton
            aria-label="Go forward"
            disabled={!tab?.navigation.canGoForward}
            onClick={() => tab && void trpc.tabs.goToOffset.mutate({ tabId: tab.id, offset: 1 })}
          >
            <ArrowRight className="h-[18px] w-[18px]" />
          </IconButton>
        </Tooltip>
        <Tooltip content={loading ? 'Stop' : 'Reload'} shortcut="⌘R">
          <IconButton
            aria-label={loading ? 'Stop loading' : 'Reload page'}
            disabled={!tab}
            onClick={() => {
              if (!tab) return;
              if (loading) void trpc.tabs.stop.mutate({ tabId: tab.id });
              else void trpc.tabs.reload.mutate({ tabId: tab.id });
            }}
          >
            {loading ? <X className="h-[18px] w-[18px]" /> : <RotateCw className="h-[18px] w-[18px]" />}
          </IconButton>
        </Tooltip>
      </div>

      <AddressPill />

      {splitActive && (
        <button
          type="button"
          onClick={() => dispatchCommand('view.splitView')}
          className="no-drag flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-[12px] font-medium text-accent transition-colors hover:brightness-110"
        >
          <Columns2 className="h-3.5 w-3.5" /> Exit split
        </button>
      )}

      <div className="no-drag flex items-center gap-0.5">
        <Tooltip content="Reader mode">
          <IconButton
            aria-label="Toggle reader mode"
            aria-pressed={readerActive}
            active={readerActive}
            disabled={!canBookmark}
            onClick={() => dispatchCommand('view.readerMode')}
          >
            <BookOpen className="h-[18px] w-[18px]" />
          </IconButton>
        </Tooltip>
        <ZoomControl />
        <Tooltip content={bookmarked ? 'Edit bookmark' : 'Bookmark this page'} shortcut="⌘D">
          <IconButton
            aria-label={bookmarked ? 'Edit bookmark' : 'Bookmark this page'}
            aria-pressed={bookmarked}
            active={bookmarked}
            disabled={!canBookmark}
            onClick={() => {
              dispatchCommand('tools.bookmarkPage');
              setBookmarked((value) => !value);
            }}
          >
            <Bookmark
              className={bookmarked ? 'h-[18px] w-[18px] fill-accent text-accent' : 'h-[18px] w-[18px]'}
            />
          </IconButton>
        </Tooltip>
        <Tooltip content="Downloads" shortcut="⌘⇧J">
          <IconButton
            aria-label={
              activeDownloads > 0 ? `Downloads, ${activeDownloads} active` : 'Downloads'
            }
            onClick={() => dispatchCommand('tools.downloads')}
            className="relative"
          >
            <Download className="h-[18px] w-[18px]" />
            {activeDownloads > 0 && (
              <span
                aria-live="polite"
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-fg tabular-nums"
              >
                {activeDownloads}
              </span>
            )}
          </IconButton>
        </Tooltip>
        <Tooltip content="Command palette" shortcut="⌘K">
          <IconButton
            aria-label="Open command palette"
            onClick={() => dispatchCommand('tools.commandPalette')}
          >
            <Command className="h-[18px] w-[18px]" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
}
