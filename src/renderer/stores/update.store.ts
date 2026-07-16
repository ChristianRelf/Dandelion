import { create } from 'zustand';
import { trpc } from '../lib/trpc/client';

interface UpdateStore {
  /** Version downloaded and waiting to be installed, or null when none is. */
  readyVersion: string | null;
  /** Cleared for this run once dismissed, so the chip is not nagging. */
  dismissed: boolean;
  hydrate: () => Promise<void>;
  setReady: (version: string) => void;
  dismiss: () => void;
}

/**
 * Whether a downloaded update is waiting. The main process owns the real state;
 * this mirrors it from `app:update-downloaded` and hydrates on load, so a
 * renderer reload cannot lose a pending update.
 */
export const useUpdateStore = create<UpdateStore>((set) => ({
  readyVersion: null,
  dismissed: false,

  hydrate: async () => {
    const version = await trpc.app.pendingUpdate.query();
    if (version) set({ readyVersion: version });
  },

  setReady: (readyVersion) => set({ readyVersion, dismissed: false }),
  dismiss: () => set({ dismissed: true }),
}));

export function selectUpdateReady(state: UpdateStore): boolean {
  return state.readyVersion !== null && !state.dismissed;
}
