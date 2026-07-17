import { useEffect, useState, type ReactElement } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Columns2,
  Command,
  House,
  RotateCw,
  X,
} from 'lucide-react';
import { isInternalUrl } from '@shared/constants';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { AddressPill } from './AddressPill';
import { ZoomControl } from './ZoomControl';
import { DownloadsPopover } from './DownloadsPopover';
import { UpdateChip } from './UpdateChip';
import { useActiveTab } from '../../hooks/useBrowser';
import { selectSplitActive, useBrowserStore } from '../../stores/browser.store';
import { useReaderStore } from '../../stores/reader.store';
import { trpc } from '../../lib/trpc/client';
import { onBrowserEventOf } from '../../lib/events';
import { dispatchCommand } from '../../lib/commands';

/** The navigation + address + actions row above the content area. */
export function Toolbar(): ReactElement {
  const tab = useActiveTab();
  const profileId = useBrowserStore((state) => state.profile?.id);
  const readerTabId = useReaderStore((state) => state.tabId);
  const splitActive = useBrowserStore(selectSplitActive);
  const loading = tab?.status === 'loading';
  const [bookmarked, setBookmarked] = useState(false);

  const canBookmark = !!tab && !!tab.url && !isInternalUrl(tab.url);
  const readerActive = !!tab && readerTabId === tab.id;

  // Only the URL decides whether this page is bookmarked. Depending on the whole
  // `tab` refired this query on every `tab:updated` — title, favicon, status —
  // for the length of every page load.
  const bookmarkableUrl = canBookmark && tab ? tab.url : null;

  useEffect(() => {
    if (!profileId || !bookmarkableUrl) {
      setBookmarked(false);
      return;
    }
    let cancelled = false;
    void trpc.bookmarks.isBookmarked
      .query({ profileId, url: bookmarkableUrl })
      .then((result) => !cancelled && setBookmarked(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [profileId, bookmarkableUrl]);

  // The star reflects what main says, not what the click hoped for. `⌘D` and the
  // palette reach the DB without touching this component, so an optimistic
  // toggle here inverted the indicator as soon as the two were mixed.
  useEffect(
    () =>
      onBrowserEventOf('bookmark:changed', (event) => {
        if (event.profileId === profileId && event.url === bookmarkableUrl) {
          setBookmarked(event.bookmarked);
        }
      }),
    [profileId, bookmarkableUrl],
  );

  return (
    <div className="flex h-[var(--toolbar-height)] shrink-0 items-center gap-1 px-2 drag">
      <div className="flex items-center gap-0.5 no-drag">
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
            {loading ? (
              <X className="h-[18px] w-[18px]" />
            ) : (
              <RotateCw className="h-[18px] w-[18px]" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip content="Home" shortcut="⌥Home">
          <IconButton
            aria-label="Go to home page"
            disabled={!tab}
            onClick={() => dispatchCommand('navigation.home')}
          >
            <House className="h-[18px] w-[18px]" />
          </IconButton>
        </Tooltip>
      </div>

      <AddressPill />

      {splitActive && (
        <button
          type="button"
          onClick={() => dispatchCommand('view.splitView')}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-[12px] font-medium text-accent transition-colors no-drag hover:brightness-110"
        >
          <Columns2 className="h-3.5 w-3.5" /> Exit split
        </button>
      )}

      <div className="flex items-center gap-0.5 no-drag">
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
            onClick={() => dispatchCommand('tools.bookmarkPage')}
          >
            <Bookmark
              className={
                bookmarked ? 'h-[18px] w-[18px] fill-accent text-accent' : 'h-[18px] w-[18px]'
              }
            />
          </IconButton>
        </Tooltip>
        <UpdateChip />
        <DownloadsPopover />
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
