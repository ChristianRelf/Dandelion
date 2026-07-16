import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import type { OmniboxResult } from '@shared/types';
import { classifyOmniboxInput } from '@shared/utils';
import { cn } from '../../lib/cn';
import { Icon } from '../ui/Icon';
import { trpc } from '../../lib/trpc/client';
import { dispatchCommand } from '../../lib/commands';
import { useUiStore } from '../../stores/ui.store';
import { useBrowserStore } from '../../stores/browser.store';

export function Omnibox(): ReactElement {
  const open = useUiStore((state) => state.omniboxOpen);
  const initialValue = useUiStore((state) => state.omniboxInitialValue);
  const close = useUiStore((state) => state.closeOmnibox);
  const profileId = useBrowserStore((state) => state.profile?.id);

  const [value, setValue] = useState('');
  const [results, setResults] = useState<OmniboxResult[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const runQuery = useCallback(
    (query: string) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void trpc.omnibox.query.query({ input: query, limit: 9, profileId }).then((next) => {
          setResults(next);
          setSelected(0);
        });
      }, 80);
    },
    [profileId],
  );

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setSelected(0);
    runQuery(initialValue);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open, initialValue, runQuery]);

  const navigateTo = (url: string): void => {
    const { activeTabId, activeWorkspaceId } = useBrowserStore.getState();
    if (activeTabId) void trpc.tabs.navigate.mutate({ tabId: activeTabId, url });
    else if (activeWorkspaceId)
      void trpc.tabs.create.mutate({ workspaceId: activeWorkspaceId, url, active: true });
  };

  const activate = (result: OmniboxResult): void => {
    switch (result.kind) {
      case 'openTab':
        if (result.tabId) void trpc.tabs.activate.mutate({ tabId: result.tabId });
        break;
      case 'action':
        if (result.actionId) dispatchCommand(result.actionId);
        break;
      case 'calculator':
      case 'unitConversion':
        void navigator.clipboard.writeText(result.title);
        break;
      default:
        if (result.url) navigateTo(result.url);
    }
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = results[selected] ?? results[0];
      if (chosen) activate(chosen);
      else if (value.trim()) {
        const intent = classifyOmniboxInput(value);
        navigateTo(
          intent.kind === 'url'
            ? intent.url
            : `https://duckduckgo.com/?q=${encodeURIComponent(value)}`,
        );
        close();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const completion = results[0]?.inlineCompletion;
      if (completion) {
        event.preventDefault();
        const next = value + completion;
        setValue(next);
        runQuery(next);
      }
    }
  };

  const completion = results[0]?.inlineCompletion ?? '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={close}
        >
          <motion.div
            className="mt-[12vh] h-fit w-[640px] max-w-[92vw] overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-glass)] glass"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4">
              <Search className="h-4.5 w-4.5 shrink-0 text-faint" />
              <div className="relative flex-1">
                {completion && (
                  <div className="pointer-events-none absolute inset-0 flex items-center py-3.5 text-[15px] text-faint">
                    <span className="invisible">{value}</span>
                    <span>{completion}</span>
                  </div>
                )}
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    runQuery(event.target.value);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search or enter address"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent py-3.5 text-[15px] text-text outline-none placeholder:text-faint"
                />
              </div>
            </div>

            {results.length > 0 && (
              <div className="max-h-[52vh] overflow-y-auto border-t border-line p-1.5">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    type="button"
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => activate(result)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      index === selected ? 'bg-surface-active' : 'hover:bg-surface-hover',
                    )}
                  >
                    <Icon name={result.icon ?? 'globe'} className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                      {result.title}
                    </span>
                    {result.subtitle && (
                      <span className="shrink-0 truncate text-xs text-faint">
                        {result.subtitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
