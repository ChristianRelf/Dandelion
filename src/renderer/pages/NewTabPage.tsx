import type { ReactElement } from 'react';
import { motion } from 'motion/react';
import { Command, Search } from 'lucide-react';
import type { HistoryEntry } from '@shared/types';
import { getHostname, prettifyUrl } from '@shared/utils';
import { DandelionMark } from '../components/brand/DandelionMark';
import { Favicon } from '../components/ui/Favicon';
import { Kbd } from '../components/ui/Kbd';
import { Skeleton } from '../components/ui/Skeleton';
import { useAsyncData } from '../hooks/useAsyncData';
import { toast } from '../stores/toast.store';
import { trpc } from '../lib/trpc/client';
import { useUiStore } from '../stores/ui.store';
import { selectWallpaper, useBrowserStore } from '../stores/browser.store';
import { wallpaperBackground, wallpaperBlur } from '../lib/wallpaper';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function NewTabPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const wallpaper = useBrowserStore(selectWallpaper);
  const openOmnibox = useUiStore((state) => state.openOmnibox);

  const { status, data: topSites } = useAsyncData<HistoryEntry[]>(
    () =>
      profile
        ? trpc.history.topSites.query({ profileId: profile.id, limit: 10 })
        : Promise.resolve([]),
    [profile?.id],
    [],
  );

  const openSite = (url: string): void => {
    const { activeTabId, activeWorkspaceId } = useBrowserStore.getState();
    if (activeTabId) {
      void trpc.tabs.navigate
        .mutate({ tabId: activeTabId, url })
        .catch(() => toast.error('Could not open site'));
    } else if (activeWorkspaceId) {
      void trpc.tabs.create
        .mutate({ workspaceId: activeWorkspaceId, url, active: true })
        .catch(() => toast.error('Could not open site'));
    }
  };

  const showTiles = status === 'loading' || topSites.length > 0;

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-9 px-6 pb-16">
      {wallpaper && (
        // Decorative and behind everything: the page's own text and controls
        // keep their themed colours, and `dim` is what keeps them legible over
        // a busy picture.
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: wallpaperBackground(wallpaper),
              // Blur samples beyond the element's edge, which would show the
              // surface through a soft border; scaling up crops that away.
              filter: wallpaperBlur(wallpaper),
              transform: wallpaper.blur > 0 ? 'scale(1.1)' : undefined,
            }}
          />
          <div className="absolute inset-0 bg-bg" style={{ opacity: wallpaper.dim }} />
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <DandelionMark className="mb-5 h-14 w-14 text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}</h1>
      </motion.div>

      <motion.button
        type="button"
        onClick={() => openOmnibox('')}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
        className={`group relative z-10 flex w-[460px] max-w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left shadow-[var(--shadow-glass)] glass transition-colors no-drag hover:border-line-strong ${FOCUS_RING}`}
      >
        <Search className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-muted" />
        <span className="flex-1 text-sm text-faint">Search the web or type a URL…</span>
        <span className="flex shrink-0 items-center gap-1">
          <Kbd>
            <Command className="h-3 w-3" />
          </Kbd>
          <Kbd>K</Kbd>
        </span>
      </motion.button>

      {showTiles && (
        <div className="relative z-10 grid w-[560px] max-w-full grid-cols-4 gap-3 sm:grid-cols-5">
          {status === 'loading'
            ? Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <Skeleton className="h-14 w-14 rounded-2xl" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))
            : topSites.map((site, index) => {
                const host = getHostname(site.url) || prettifyUrl(site.url);
                return (
                  <motion.button
                    key={site.id}
                    type="button"
                    onClick={() => openSite(site.url)}
                    title={host}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: 0.1 + index * 0.03,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`group flex flex-col items-center gap-2 rounded-2xl p-1 no-drag ${FOCUS_RING}`}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface transition-colors group-hover:border-line-strong group-hover:bg-surface-hover">
                      <Favicon src={site.favicon} className="h-6 w-6" />
                    </span>
                    <span className="max-w-full truncate text-[11px] text-muted">{host}</span>
                  </motion.button>
                );
              })}
        </div>
      )}
    </div>
  );
}
