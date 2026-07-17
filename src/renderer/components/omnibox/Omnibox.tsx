import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, ExternalLink, Search, Trash2 } from 'lucide-react';
import type { OmniboxResult } from '@shared/types';
import { classifyOmniboxInput } from '@shared/utils';
import { cn } from '../../lib/cn';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';
import { trpc } from '../../lib/trpc/client';
import { dispatchCommand } from '../../lib/commands';
import { copyText } from '../../lib/clipboard';
import { openUrl, openUrlInNewTab } from '../../lib/navigation';
import { toast } from '../../stores/toast.store';
import { useUiStore } from '../../stores/ui.store';
import { useBrowserStore } from '../../stores/browser.store';

/** Computed answers have no destination — their text is the thing worth copying. */
const ANSWER_KINDS = new Set<OmniboxResult['kind']>(['calculator', 'unitConversion', 'timezone']);

/** What a result's copy action puts on the clipboard, or `null` if it has none. */
function copyableText(result: OmniboxResult): string | null {
  if (ANSWER_KINDS.has(result.kind)) return result.title;
  return result.url;
}

export function Omnibox(): ReactElement {
  const open = useUiStore((state) => state.omniboxOpen);
  const initialValue = useUiStore((state) => state.omniboxInitialValue);
  const close = useUiStore((state) => state.closeOmnibox);
  const profileId = useBrowserStore((state) => state.profile?.id);

  const [value, setValue] = useState('');
  const [results, setResults] = useState<OmniboxResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const runQuery = useCallback(
    (query: string) => {
      clearTimeout(timer.current);
      setLoading(true);
      timer.current = setTimeout(() => {
        const current = ++seq.current;
        void trpc.omnibox.query
          .query({ input: query, limit: 9, profileId })
          .then((next) => {
            if (current !== seq.current) return;
            setResults(next);
            setSelected(0);
            setLoading(false);
          })
          .catch(() => {
            if (current !== seq.current) return;
            setResults([]);
            setLoading(false);
          });
      }, 80);
    },
    [profileId],
  );

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    setValue(initialValue);
    setSelected(0);
    runQuery(initialValue);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open, initialValue, runQuery]);

  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current.focus?.();
      restoreFocus.current = null;
    }
  }, [open]);

  const navigateTo = (url: string): void => {
    void openUrl(url).catch(() => toast.error('Could not open that link'));
  };

  const activate = (result: OmniboxResult): void => {
    switch (result.kind) {
      case 'openTab':
        if (result.tabId) void trpc.tabs.activate.mutate({ tabId: result.tabId });
        break;
      case 'action':
        if (result.actionId) dispatchCommand(result.actionId);
        break;
      // Computed answers have no destination — copying is the useful action.
      case 'calculator':
      case 'unitConversion':
      case 'timezone':
        void copyText(result.title, result.title);
        break;
      default:
        if (result.url) navigateTo(result.url);
    }
    close();
  };

  const copyResult = (result: OmniboxResult): void => {
    const text = copyableText(result);
    if (text) void copyText(text, text);
    close();
  };

  const openInNewTab = (result: OmniboxResult): void => {
    if (!result.url) return;
    void openUrlInNewTab(result.url).catch(() => toast.error('Could not open that link'));
    close();
  };

  /**
   * Drop a result's URL from history and prune the row in place.
   *
   * Deliberately not a re-query: `history.prefixMatch` full-scans and sorts all
   * history on the main process (a known P2), so refetching to redraw one fewer
   * row would pay that cost again for nothing.
   */
  const removeFromHistory = (result: OmniboxResult, index: number): void => {
    if (!profileId || !result.url) return;
    const url = result.url;
    void trpc.history.delete
      .mutate({ profileId, url })
      .then(() => {
        setResults((current) => current.filter((entry) => entry.id !== result.id));
        setSelected((current) => Math.max(0, current > index ? current - 1 : current));
        toast.success('Removed from history', { description: url });
      })
      .catch(() => toast.error('Could not remove from history'));
  };

  const commitRaw = (): void => {
    if (!value.trim()) return;
    const intent = classifyOmniboxInput(value);
    navigateTo(
      intent.kind === 'url' ? intent.url : `https://duckduckgo.com/?q=${encodeURIComponent(value)}`,
    );
    close();
  };

  const completion = results[0]?.inlineCompletion ?? '';

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelected((current) => Math.min(current + 1, results.length - 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        setSelected((current) => Math.max(current - 1, 0));
        return;
      case 'Enter': {
        event.preventDefault();
        const chosen = results[selected] ?? results[0];
        if (!chosen) {
          commitRaw();
          return;
        }
        // The switch keys off `event.key` alone, so without this guard a
        // modified Enter would fall through and navigate as well.
        if ((event.ctrlKey || event.metaKey) && chosen.url) openInNewTab(chosen);
        else activate(chosen);
        return;
      }
      // Chrome's convention for dropping the suggestion under the cursor.
      case 'Delete': {
        if (!event.shiftKey) return;
        const chosen = results[selected];
        if (!chosen?.inHistory) return;
        event.preventDefault();
        removeFromHistory(chosen, selected);
        return;
      }
      case 'Escape':
        event.preventDefault();
        close();
        return;
      case 'Tab': {
        // Keep focus in the field: accept the inline completion, else the top result.
        event.preventDefault();
        if (completion) {
          const next = value + completion;
          setValue(next);
          runQuery(next);
        } else {
          setSelected((current) => Math.min(current + 1, results.length - 1));
        }
        return;
      }
      default:
        return;
    }
  };

  const showPanel = loading || results.length > 0 || value.trim().length > 0;

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
            className="mt-[12vh] h-fit w-[640px] max-w-[92vw] overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-lg)] glass-strong"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4">
              {loading ? (
                <Spinner size={16} className="shrink-0 text-faint" />
              ) : (
                <Search className="h-4 w-4 shrink-0 text-faint" />
              )}
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
                  role="combobox"
                  aria-expanded={results.length > 0}
                  aria-controls="omnibox-listbox"
                  aria-activedescendant={
                    results[selected] ? `omnibox-option-${selected}` : undefined
                  }
                  aria-autocomplete="list"
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

            {showPanel && (
              <div
                id="omnibox-listbox"
                role="listbox"
                aria-label="Suggestions"
                className="scrollbar-slim max-h-[52vh] overflow-y-auto border-t border-line p-1.5"
              >
                {results.map((result, index) => {
                  const copyable = copyableText(result);
                  const hasActions = copyable || result.url || result.inHistory;
                  return (
                    <div
                      key={result.id}
                      id={`omnibox-option-${index}`}
                      role="option"
                      aria-selected={index === selected}
                      onMouseEnter={() => setSelected(index)}
                      onClick={() => activate(result)}
                      className={cn(
                        'group flex w-full cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                        index === selected ? 'bg-surface-active' : 'hover:bg-surface-hover',
                      )}
                    >
                      <Icon name={result.icon ?? 'globe'} className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
                        {result.title}
                      </span>
                      {result.subtitle && (
                        // Allowed to shrink rather than hide when the actions
                        // appear: the subtitle is the URL, which is precisely
                        // what you are reaching for Copy to take.
                        <span className="min-w-0 shrink truncate text-xs text-faint">
                          {result.subtitle}
                        </span>
                      )}
                      {hasActions && (
                        /*
                         * Hidden from the accessibility tree on purpose.
                         * Interactive children of a `role="option"` are not
                         * reachable regardless — focus stays in the input and
                         * selection runs through `aria-activedescendant` — so
                         * exposing them would buy nothing and would fold "Copy
                         * link Open in new tab Remove from history" into every
                         * option's announced name.
                         *
                         * The keyboard paths are the ones Chrome uses:
                         * Ctrl+Enter opens in a new tab, Shift+Delete forgets a
                         * suggestion, and Enter copies a computed answer.
                         * Copying a *link* is mouse-only, as it is in Chrome —
                         * Ctrl+Shift+C, the obvious candidate, never arrives:
                         * Chromium claims it for inspect-element before the
                         * page sees the keydown.
                         */
                        <div
                          aria-hidden
                          className="hidden shrink-0 items-center gap-0.5 group-hover:flex"
                          // The row itself navigates, so a click on an action
                          // must not reach it.
                          onClick={(event) => event.stopPropagation()}
                          // Chromium focuses a button on mousedown, which would
                          // take focus out of the field and leave the omnibox
                          // keyboard-dead — arrow keys and Escape are handled
                          // there. Removing a suggestion should not cost you
                          // the ability to type.
                          onMouseDown={(event) => event.preventDefault()}
                        >
                          {copyable && (
                            <IconButton
                              size="sm"
                              tabIndex={-1}
                              title={ANSWER_KINDS.has(result.kind) ? 'Copy answer' : 'Copy link'}
                              aria-label="Copy"
                              onClick={() => copyResult(result)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </IconButton>
                          )}
                          {result.url && (
                            <IconButton
                              size="sm"
                              tabIndex={-1}
                              title="Open in new tab"
                              aria-label="Open in new tab"
                              onClick={() => openInNewTab(result)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </IconButton>
                          )}
                          {result.inHistory && (
                            <IconButton
                              size="sm"
                              tabIndex={-1}
                              title="Remove from history"
                              aria-label="Remove from history"
                              onClick={() => removeFromHistory(result, index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconButton>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!loading && results.length === 0 && value.trim() && (
                  <div className="px-3 py-6 text-center text-[13px] text-faint">
                    Press <span className="text-muted">Enter</span> to search for “{value.trim()}”
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
