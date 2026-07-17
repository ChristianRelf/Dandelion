import { create } from 'zustand';
import type { UpdateStatus } from '@shared/types';
import { trpc } from '../lib/trpc/client';

interface UpdateStore {
  status: UpdateStatus;
  /**
   * The ready version the user waved away, so the chip stops asking. Keyed by
   * version rather than a flag: dismissing 0.3.0 should not silence 0.4.0.
   */
  dismissedVersion: string | null;
  hydrate: () => Promise<void>;
  setStatus: (status: UpdateStatus) => void;
  dismiss: (version: string) => void;
}

/**
 * Mirrors the updater. The main process owns the real state; this follows it
 * via `app:update-status` and hydrates on load, so a renderer reload cannot
 * lose a download in flight or an update already waiting.
 */
export const useUpdateStore = create<UpdateStore>((set) => ({
  status: { phase: 'idle' },
  dismissedVersion: null,

  hydrate: async () => {
    set({ status: await trpc.app.updateStatus.query() });
  },

  setStatus: (status) => set({ status }),

  /**
   * From `app:update-dismissed`. The button that dismisses lives in the popup
   * surface — a different renderer from the chip that reads this — so the choice
   * arrives relayed by main rather than made here.
   */
  dismiss: (version) => set({ dismissedVersion: version }),
}));

/** The only phases the toolbar chip ever renders. */
export type ChipStatus = Extract<UpdateStatus, { phase: 'downloading' | 'ready' }>;

/**
 * What the toolbar chip should show, or null to stay out of the way.
 *
 * Only progress and readiness earn a place in the toolbar. Checking is
 * invisible by design, and a failed background check is not the user's problem
 * to solve — the About page carries both for anyone who goes looking.
 *
 * Returns the status object itself rather than deriving a new one, so the
 * reference stays stable between renders.
 */
export function selectChipStatus(state: UpdateStore): ChipStatus | null {
  const { status } = state;
  if (status.phase === 'downloading') return status;
  if (status.phase === 'ready' && status.version !== state.dismissedVersion) return status;
  return null;
}
