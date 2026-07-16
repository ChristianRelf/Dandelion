import { create } from 'zustand';
import type { Download } from '@shared/types';
import { trpc } from '../lib/trpc/client';

interface DownloadsStore {
  downloads: Record<string, Download>;
  loaded: boolean;
  load: (profileId: string) => Promise<void>;
  apply: (download: Download) => void;
  remove: (id: string) => void;
}

export const useDownloadsStore = create<DownloadsStore>((set) => ({
  downloads: {},
  loaded: false,

  load: async (profileId) => {
    const list = await trpc.downloads.list.query({ profileId });
    const record: Record<string, Download> = {};
    for (const download of list) record[download.id] = download;
    set({ downloads: record, loaded: true });
  },

  apply: (download) =>
    set((state) => ({ downloads: { ...state.downloads, [download.id]: download } })),

  remove: (id) =>
    set((state) => {
      const next = { ...state.downloads };
      delete next[id];
      return { downloads: next };
    }),
}));

export function selectActiveDownloadCount(state: DownloadsStore): number {
  return Object.values(state.downloads).filter(
    (download) => download.state === 'in_progress' || download.state === 'paused',
  ).length;
}
