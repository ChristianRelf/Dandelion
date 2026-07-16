import { useEffect, useState, type ReactElement } from 'react';
import { motion } from 'motion/react';
import { Command, Search } from 'lucide-react';
import type { HistoryEntry } from '@shared/types';
import { getHostname, prettifyUrl } from '@shared/utils';
import { DandelionMark } from '../components/brand/DandelionMark';
import { Favicon } from '../components/ui/Favicon';
import { trpc } from '../lib/trpc/client';
import { useUiStore } from '../stores/ui.store';
import { useBrowserStore } from '../stores/browser.store';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function NewTabPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const openOmnibox = useUiStore((state) => state.openOmnibox);
  const [topSites, setTopSites] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (profile)
      void trpc.history.topSites.query({ profileId: profile.id, limit: 10 }).then(setTopSites);
  }, [profile]);

  const openSite = (url: string): void => {
    const { activeTabId, activeWorkspaceId } = useBrowserStore.getState();
    if (activeTabId) void trpc.tabs.navigate.mutate({ tabId: activeTabId, url });
    else if (activeWorkspaceId)
      void trpc.tabs.create.mutate({ workspaceId: activeWorkspaceId, url, active: true });
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-9 px-6 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        <DandelionMark className="mb-5 h-14 w-14 text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}</h1>
      </motion.div>

      <button
        type="button"
        onClick={() => openOmnibox('')}
        className="flex w-[460px] max-w-full items-center gap-3 rounded-2xl border border-line px-4 py-3.5 text-left shadow-[var(--shadow-glass)] glass transition-colors hover:border-line-strong"
      >
        <Search className="h-4.5 w-4.5 text-faint" />
        <span className="flex-1 text-sm text-faint">Search the web or type a URL…</span>
        <span className="flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-1 text-[11px] text-muted">
          <Command className="h-3 w-3" /> K
        </span>
      </button>

      {topSites.length > 0 && (
        <div className="grid w-[560px] max-w-full grid-cols-5 gap-3">
          {topSites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => openSite(site.url)}
              className="group flex flex-col items-center gap-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface transition-colors group-hover:bg-surface-hover">
                <Favicon src={site.favicon} className="h-6 w-6" />
              </span>
              <span className="max-w-full truncate text-[11px] text-muted">
                {getHostname(site.url) || prettifyUrl(site.url)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
