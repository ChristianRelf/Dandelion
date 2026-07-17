import { create } from 'zustand';
import type { ReaderArticle } from '@shared/types';
import { trpc } from '../lib/trpc/client';
import { SpeechController, chunkArticle } from '../lib/speech';

export type SpeechStatus = 'idle' | 'playing' | 'paused';

/**
 * One engine per renderer — `speechSynthesis` is per renderer, so a second
 * window reads with its own and neither can silence the other.
 */
const speech = new SpeechController();

interface ReaderStore {
  /** The tab currently shown in reader mode, or null. */
  tabId: string | null;
  article: ReaderArticle | null;
  status: 'idle' | 'loading' | 'error';
  speechStatus: SpeechStatus;
  /** The block being read aloud, for the highlight. */
  spokenBlock: number | null;

  open: (tabId: string) => Promise<void>;
  close: () => void;
  toggle: (tabId: string) => void;
  speak: (rate: number) => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
}

export const speechSupported = SpeechController.supported;

export const useReaderStore = create<ReaderStore>((set, get) => ({
  tabId: null,
  article: null,
  status: 'idle',
  speechStatus: 'idle',
  spokenBlock: null,

  open: async (tabId) => {
    // Opening the reader on a different tab never passed through `close`, so
    // without this the previous article would keep reading aloud under the new
    // one's text.
    get().stopSpeech();
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

  /**
   * The one chokepoint every dismissal reaches — the header's X, the toolbar
   * toggle, and the navigation handler in AppProvider — so it is where the
   * reading has to stop.
   */
  close: () => {
    get().stopSpeech();
    set({ tabId: null, article: null, status: 'idle' });
  },

  toggle: (tabId) => {
    if (get().tabId === tabId) get().close();
    else void get().open(tabId);
  },

  speak: (rate) => {
    const article = get().article;
    if (!article) return;
    const chunks = chunkArticle(article.blocks);
    if (chunks.length === 0) return;
    set({ speechStatus: 'playing' });
    speech.speak(chunks, rate, {
      onBlock: (spokenBlock) => set({ spokenBlock }),
      onDone: () => set({ speechStatus: 'idle', spokenBlock: null }),
    });
  },

  pauseSpeech: () => {
    speech.pause();
    set({ speechStatus: 'paused' });
  },

  resumeSpeech: () => {
    speech.resume();
    set({ speechStatus: 'playing' });
  },

  stopSpeech: () => {
    speech.stop();
    set({ speechStatus: 'idle', spokenBlock: null });
  },
}));
