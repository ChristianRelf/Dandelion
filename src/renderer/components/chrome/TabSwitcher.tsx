import { useEffect, useMemo, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { prettifyUrl } from '@shared/utils';
import { Favicon } from '../ui/Favicon';
import { EmptyState } from '../ui/EmptyState';
import { trpc } from '../../lib/trpc/client';
import { useUiStore } from '../../stores/ui.store';
import { useOrderedTabs } from '../../hooks/useBrowser';

/** Quick tab switcher (⌘⇧A): fuzzy search across the workspace's tabs, MRU-first. */
export function TabSwitcher(): ReactElement {
  const open = useUiStore((state) => state.tabSwitcherOpen);
  const close = useUiStore((state) => state.closeTabSwitcher);
  const tabs = useOrderedTabs();

  const mru = useMemo(() => [...tabs].sort((a, b) => b.lastActiveAt - a.lastActiveAt), [tabs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && open) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[66] flex justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={close}
        >
          <motion.div
            className="mt-[12vh] h-fit w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-lg)] glass-strong"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Command loop className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="h-4 w-4 shrink-0 text-faint" />
                <Command.Input
                  autoFocus
                  placeholder="Switch to a tab…"
                  className="w-full bg-transparent py-3.5 text-[15px] text-text outline-none placeholder:text-faint"
                />
              </div>
              <Command.List className="scrollbar-slim max-h-[52vh] overflow-y-auto p-1.5">
                <Command.Empty>
                  <EmptyState
                    compact
                    icon="search-x"
                    title="No tabs match"
                    description="Try a different search term."
                  />
                </Command.Empty>
                {mru.map((tab) => (
                  <Command.Item
                    key={tab.id}
                    value={`${tab.title} ${tab.url}`}
                    onSelect={() => {
                      void trpc.tabs.activate.mutate({ tabId: tab.id });
                      close();
                    }}
                    className="flex cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] text-muted outline-none data-[selected=true]:bg-surface-active data-[selected=true]:text-text"
                  >
                    <Favicon src={tab.favicon} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-text">
                      {tab.title || prettifyUrl(tab.url)}
                    </span>
                    <span className="shrink-0 truncate text-xs text-faint">
                      {prettifyUrl(tab.url)}
                    </span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
