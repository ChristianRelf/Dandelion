import { useEffect, useRef, useState, type ReactElement } from 'react';
import { FileText, Languages, Lightbulb, Send, Sparkles, X } from 'lucide-react';
import type { AiMessage, AiProviderInfo } from '@shared/types';
import { cn } from '../../lib/cn';
import { IconButton } from '../ui/IconButton';
import { trpc } from '../../lib/trpc/client';
import { onBrowserEventOf } from '../../lib/events';
import { useUiStore } from '../../stores/ui.store';
import { useBrowserStore } from '../../stores/browser.store';

export function AiSidebar(): ReactElement {
  const close = useUiStore((state) => state.toggleAiSidebar);
  const settings = useBrowserStore((state) => state.settings);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void trpc.ai.providers.query().then(setProviders);
  }, []);

  useEffect(
    () =>
      onBrowserEventOf('ai:chunk', (event) => {
        if (event.chunk.requestId !== requestId.current) return;
        if (event.chunk.error) {
          setMessages((current) => [
            ...current,
            { role: 'assistant', content: `⚠︎ ${event.chunk.error}` },
          ]);
          setStreaming('');
          setBusy(false);
          requestId.current = null;
          return;
        }
        if (event.chunk.done) {
          setStreaming((current) => {
            if (current)
              setMessages((messages) => [...messages, { role: 'assistant', content: current }]);
            return '';
          });
          setBusy(false);
          requestId.current = null;
          return;
        }
        setStreaming((current) => current + event.chunk.delta);
      }),
    [],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  const providerId = settings?.ai.defaultProvider ?? 'anthropic';
  const provider = providers.find((candidate) => candidate.id === providerId);
  const configured = provider?.configured ?? false;
  const model = provider?.models[0]?.id ?? '';

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (!text || busy) return;
    const next: AiMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    const { requestId: id } = await trpc.ai.complete.mutate({
      providerId,
      model,
      messages: next,
      temperature: 0.7,
      task: 'chat',
    });
    requestId.current = id;
  };

  const runPageAction = async (task: 'summarize' | 'explain' | 'translate'): Promise<void> => {
    const tabId = useBrowserStore.getState().activeTabId;
    if (!tabId || busy) return;
    setMessages((current) => [...current, { role: 'user', content: `${task} this page` }]);
    setBusy(true);
    const { requestId: id } = await trpc.ai.pageAction.mutate({ tabId, task });
    requestId.current = id;
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col py-2 pr-2">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line glass">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="flex-1 text-[13px] font-medium">Assistant</span>
          <IconButton size="sm" onClick={close} aria-label="Close assistant">
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        {!configured && (
          <div className="mx-3 mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
            Add an API key under Settings → AI to enable the assistant.
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
        >
          {messages.length === 0 && !streaming && (
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
                  ? 'self-end bg-accent/15 text-text'
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
        </div>

        <div className="flex gap-1 px-3 pb-2">
          {(
            [
              ['summarize', FileText],
              ['explain', Lightbulb],
              ['translate', Languages],
            ] as const
          ).map(([task, IconComponent]) => (
            <button
              key={task}
              type="button"
              disabled={busy}
              onClick={() => void runPageAction(task)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] text-muted capitalize transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
            >
              <IconComponent className="h-3.5 w-3.5" />
              {task}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2 border-t border-line p-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Message the assistant…"
            className="scrollbar-slim max-h-28 flex-1 resize-none bg-transparent px-1 py-1.5 text-[13px] text-text outline-none placeholder:text-faint"
          />
          <IconButton
            onClick={() => void send()}
            disabled={busy || !input.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}
