import { create } from 'zustand';
import type { ReaderArticle } from '@shared/types';
import { trpc } from '../lib/trpc/client';

interface ReaderStore {
  /** The tab currently shown in reader mode, or null. */
  tabId: string | null;
  article: ReaderArticle | null;
  status: 'idle' | 'loading' | 'error';
  /** Reader typography scale (1 = default). */
  fontScale: number;

  open: (tabId: string) => Promise<void>;
  close: () => void;
  toggle: (tabId: string) => void;
  setFontScale: (scale: number) => void;
}

export const useReaderStore = create<ReaderStore>((set, get) => ({
  tabId: null,
  article: null,
  status: 'idle',
  fontScale: 1,

  open: async (tabId) => {
    set({ tabId, status: 'loading', article: null });
    try {
      const article = await trpc.tabs.getReaderContent.query({ tabId });
      // Ignore if the user toggled away while we were fetching.
      if (get().tabId !== tabId) return;
      if (article) set({ article, status: 'idle' });
      else set({ status: 'error' });
    } catch {
      if (get().tabId === tabId) set({ status: 'error' });
    }
  },

  close: () => set({ tabId: null, article: null, status: 'idle' }),

  toggle: (tabId) => {
    if (get().tabId === tabId) get().close();
    else void get().open(tabId);
  },

  setFontScale: (fontScale) => set({ fontScale: Math.min(1.6, Math.max(0.8, fontScale)) }),
}));
