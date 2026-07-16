import { create } from 'zustand';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from './browser.store';

export interface PreviewAnchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TabPreviewStore {
  tabId: string | null;
  anchor: PreviewAnchor | null;
  thumb: string | null;
  title: string;
  url: string;
  seq: number;

  show: (tabId: string, anchor: PreviewAnchor) => void;
  hide: (tabId?: string) => void;
}

/**
 * Drives the hover preview shown beside a sidebar tab. Capturing is gated on the
 * user's thumbnail/hover-preview settings and skips the active/internal tabs.
 */
export const useTabPreviewStore = create<TabPreviewStore>((set, get) => ({
  tabId: null,
  anchor: null,
  thumb: null,
  title: '',
  url: '',
  seq: 0,

  show: (tabId, anchor) => {
    const browser = useBrowserStore.getState();
    const settings = browser.settings;
    if (!settings?.appearance.showTabThumbnails || !settings.tabs.hoverPreview) return;
    const tab = browser.tabs[tabId];
    if (!tab || tabId === browser.activeTabId) return;

    const seq = get().seq + 1;
    set({ tabId, anchor, thumb: null, title: tab.title || '', url: tab.url, seq });
    void trpc.tabs.capture
      .mutate({ tabId })
      .then((thumb) => {
        if (get().seq === seq && thumb) set({ thumb: thumb.dataUrl });
      })
      .catch(() => undefined);
  },

  hide: (tabId) => {
    if (tabId && get().tabId !== tabId) return;
    set({ tabId: null, anchor: null, thumb: null, seq: get().seq + 1 });
  },
}));
