import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { trpc } from '../../lib/trpc/client';
import { onBrowserEventOf } from '../../lib/events';
import { useUiStore } from '../../stores/ui.store';
import { useBrowserStore } from '../../stores/browser.store';

/** In-page find bar (⌘F), docked to the top-right of the content area. */
export function FindBar(): ReactElement {
  const open = useUiStore((state) => state.findOpen);
  const close = useUiStore((state) => state.closeFind);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState({ active: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      onBrowserEventOf('find:result', (event) => {
        if (event.result.tabId === activeTabId) {
          setMatches({ active: event.result.activeMatchOrdinal, total: event.result.matches });
        }
      }),
    [activeTabId],
  );

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.select());
    } else if (activeTabId) {
      void trpc.tabs.stopFind.mutate({ tabId: activeTabId, action: 'clearSelection' });
      setMatches({ active: 0, total: 0 });
    }
  }, [open, activeTabId]);

  const run = (value: string, forward: boolean): void => {
    if (!activeTabId) return;
    if (value) {
      void trpc.tabs.findInPage.mutate({
        tabId: activeTabId,
        query: value,
        forward,
        matchCase: false,
      });
    } else {
      void trpc.tabs.stopFind.mutate({ tabId: activeTabId, action: 'clearSelection' });
      setMatches({ active: 0, total: 0 });
    }
  };

  const hasMatches = matches.total > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-2 right-2 z-30 flex items-center gap-1 rounded-xl border border-line px-2 py-1.5 shadow-[var(--shadow-md)] glass-strong"
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              run(event.target.value, true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') run(query, !event.shiftKey);
              else if (event.key === 'Escape') close();
            }}
            placeholder="Find in page"
            aria-label="Find in page"
            className="w-48 bg-transparent px-1 text-[13px] text-text outline-none placeholder:text-faint"
          />
          <span
            aria-live="polite"
            className="min-w-14 text-center text-[13px] text-faint tabular-nums"
          >
            {hasMatches ? `${matches.active}/${matches.total}` : query ? 'No results' : ''}
          </span>
          <IconButton
            size="sm"
            disabled={!hasMatches}
            onClick={() => run(query, false)}
            aria-label="Previous match"
          >
            <ChevronUp className="h-4 w-4" />
          </IconButton>
          <IconButton
            size="sm"
            disabled={!hasMatches}
            onClick={() => run(query, true)}
            aria-label="Next match"
          >
            <ChevronDown className="h-4 w-4" />
          </IconButton>
          <IconButton size="sm" onClick={close} aria-label="Close find bar">
            <X className="h-4 w-4" />
          </IconButton>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
