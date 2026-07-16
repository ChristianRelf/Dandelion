import { create } from 'zustand';
import type { AiMessage, AiProviderInfo, AiStreamChunk, AiTask } from '@shared/types';
import { trpc } from '../lib/trpc/client';

export interface ChatMessage extends AiMessage {
  error?: boolean;
}

interface AiStore {
  providers: AiProviderInfo[];
  providersLoaded: boolean;
  messages: ChatMessage[];
  streaming: string;
  busy: boolean;
  requestId: string | null;
  /** Per-provider model override chosen in the picker. */
  modelByProvider: Record<string, string>;

  loadProviders: () => Promise<void>;
  setModel: (providerId: string, model: string) => void;
  send: (providerId: string, model: string, text: string) => Promise<void>;
  runPageAction: (
    providerId: string,
    model: string,
    tabId: string,
    task: Exclude<AiTask, 'chat'>,
  ) => Promise<void>;
  applyChunk: (chunk: AiStreamChunk) => void;
  stop: () => void;
  clear: () => void;
}

/**
 * Holds the assistant conversation for the window. Living outside the sidebar
 * component means the chat survives closing/reopening the panel, and streaming
 * chunks can be applied from the global event bridge.
 */
export const useAiStore = create<AiStore>((set, get) => ({
  providers: [],
  providersLoaded: false,
  messages: [],
  streaming: '',
  busy: false,
  requestId: null,
  modelByProvider: {},

  loadProviders: async () => {
    const providers = await trpc.ai.providers.query();
    set({ providers, providersLoaded: true });
  },

  setModel: (providerId, model) =>
    set((state) => ({ modelByProvider: { ...state.modelByProvider, [providerId]: model } })),

  send: async (providerId, model, text) => {
    const trimmed = text.trim();
    if (!trimmed || get().busy) return;
    const messages: ChatMessage[] = [...get().messages, { role: 'user', content: trimmed }];
    set({ messages, busy: true, streaming: '' });
    try {
      const { requestId } = await trpc.ai.complete.mutate({
        providerId,
        model,
        messages: messages.map(({ role, content }) => ({ role, content })),
        temperature: 0.7,
        task: 'chat',
      });
      set({ requestId });
    } catch (error) {
      get().applyChunk({
        requestId: get().requestId ?? '',
        delta: '',
        done: false,
        error: error instanceof Error ? error.message : 'Request failed',
      });
    }
  },

  runPageAction: async (providerId, model, tabId, task) => {
    if (get().busy) return;
    const label = task === 'summarize' ? 'Summarise' : task === 'explain' ? 'Explain' : 'Translate';
    set((state) => ({
      messages: [...state.messages, { role: 'user', content: `${label} this page` }],
      busy: true,
      streaming: '',
    }));
    try {
      const { requestId } = await trpc.ai.pageAction.mutate({ tabId, task });
      set({ requestId });
      void providerId;
      void model;
    } catch (error) {
      get().applyChunk({
        requestId: get().requestId ?? '',
        delta: '',
        done: false,
        error: error instanceof Error ? error.message : 'Request failed',
      });
    }
  },

  applyChunk: (chunk) => {
    // `requestId` is unset for errors we synthesise locally, so let those through.
    if (chunk.requestId && chunk.requestId !== get().requestId) return;
    if (chunk.error) {
      set((state) => ({
        messages: [...state.messages, { role: 'assistant', content: chunk.error!, error: true }],
        streaming: '',
        busy: false,
        requestId: null,
      }));
      return;
    }
    if (chunk.done) {
      const current = get().streaming;
      set((state) => ({
        messages: current
          ? [...state.messages, { role: 'assistant', content: current }]
          : state.messages,
        streaming: '',
        busy: false,
        requestId: null,
      }));
      return;
    }
    set((state) => ({ streaming: state.streaming + chunk.delta }));
  },

  stop: () => {
    const { requestId } = get();
    if (requestId) void trpc.ai.cancel.mutate({ requestId });
    set({ busy: false, streaming: '', requestId: null });
  },

  clear: () => set({ messages: [], streaming: '', busy: false, requestId: null }),
}));
