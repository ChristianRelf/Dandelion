import { useEffect, useRef, type ReactElement } from 'react';
import { FileText, Languages, Lightbulb, Send, Sparkles, Square, Trash2, X } from 'lucide-react';
import type { AiTask } from '@shared/types';
import { cn } from '../../lib/cn';
import { IconButton } from '../ui/IconButton';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { useUiStore } from '../../stores/ui.store';
import { useBrowserStore } from '../../stores/browser.store';
import { useAiStore } from '../../stores/ai.store';

const QUICK_ACTIONS: Array<{
  task: Exclude<AiTask, 'chat'>;
  icon: typeof FileText;
  label: string;
}> = [
  { task: 'summarize', icon: FileText, label: 'Summarise' },
  { task: 'explain', icon: Lightbulb, label: 'Explain' },
  { task: 'translate', icon: Languages, label: 'Translate' },
];

export function AiSidebar(): ReactElement {
  const close = useUiStore((state) => state.setAiSidebarOpen);
  const providerId = useBrowserStore((state) => state.settings?.ai.defaultProvider ?? 'anthropic');

  const providers = useAiStore((state) => state.providers);
  const providersLoaded = useAiStore((state) => state.providersLoaded);
  const messages = useAiStore((state) => state.messages);
  const streaming = useAiStore((state) => state.streaming);
  const busy = useAiStore((state) => state.busy);
  const modelByProvider = useAiStore((state) => state.modelByProvider);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputValue = useRef('');

  useEffect(() => {
    if (!providersLoaded) void useAiStore.getState().loadProviders();
  }, [providersLoaded]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const provider = providers.find((candidate) => candidate.id === providerId);
  const configured = provider?.configured ?? false;
  const model = modelByProvider[providerId] ?? provider?.models[0]?.id ?? '';

  const submit = (): void => {
    const text = inputValue.current;
    if (!text.trim() || busy || !configured) return;
    void useAiStore.getState().send(providerId, model, text);
    inputValue.current = '';
    if (inputRef.current) inputRef.current.value = '';
  };

  const runAction = (task: Exclude<AiTask, 'chat'>): void => {
    const tabId = useBrowserStore.getState().activeTabId;
    if (tabId && !busy && configured)
      void useAiStore.getState().runPageAction(providerId, model, tabId, task);
  };

  const empty = messages.length === 0 && !streaming;

  return (
    <aside className="flex h-full w-full flex-col py-2 pr-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line glass">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 text-accent" />
          <span className="flex-1 text-[13px] font-medium">Assistant</span>
          {configured && provider && provider.models.length > 1 && (
            <Select
              aria-label="Model"
              value={model}
              onChange={(value) => useAiStore.getState().setModel(providerId, value)}
              options={provider.models.map((entry) => ({ value: entry.id, label: entry.name }))}
              className="h-7 min-w-0 text-xs"
            />
          )}
          <IconButton
            size="sm"
            onClick={() => useAiStore.getState().clear()}
            disabled={empty}
            aria-label="New conversation"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
          <IconButton size="sm" onClick={() => close(false)} aria-label="Close assistant">
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        {!configured && (
          <div className="mx-3 mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
            Add an API key under <span className="text-text">Settings → AI</span> to enable the
            assistant.
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
        >
          {empty && configured && (
            <p className="mt-6 text-center text-xs text-faint">
              Ask anything, or act on the current page below.
            </p>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
                message.role === 'user'
                  ? 'self-end bg-accent-soft text-text'
                  : message.error
                    ? 'self-start border border-danger/30 bg-danger-soft text-danger'
                    : 'self-start bg-surface text-muted',
              )}
            >
              {message.content}
            </div>
          ))}
          {streaming && (
            <div className="max-w-[85%] self-start rounded-xl bg-surface px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-muted">
              {streaming}
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-accent align-middle" />
            </div>
          )}
          {busy && !streaming && (
            <div className="flex items-center gap-2 self-start rounded-xl bg-surface px-3 py-2 text-[13px] text-muted">
              <Spinner size={13} className="text-accent" /> Thinking…
            </div>
          )}
        </div>

        <div className="flex gap-1 px-3 pb-2">
          {QUICK_ACTIONS.map(({ task, icon: ActionIcon, label }) => (
            <button
              key={task}
              type="button"
              disabled={busy || !configured}
              onClick={() => runAction(task)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-40"
            >
              <ActionIcon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2 border-t border-line p-2">
          <textarea
            ref={inputRef}
            defaultValue=""
            disabled={!configured}
            onChange={(event) => {
              inputValue.current = event.target.value;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={configured ? 'Message the assistant…' : 'Assistant unavailable'}
            className="scrollbar-slim max-h-28 flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] text-text outline-none placeholder:text-faint disabled:opacity-50"
          />
          {busy ? (
            <IconButton onClick={() => useAiStore.getState().stop()} aria-label="Stop generating">
              <Square className="h-4 w-4 fill-current" />
            </IconButton>
          ) : (
            <IconButton onClick={submit} disabled={!configured} aria-label="Send message">
              <Send className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      </div>
    </aside>
  );
}
