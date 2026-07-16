export type SyncEntityType =
  'bookmarks' | 'history' | 'tabs' | 'passwords' | 'settings' | 'profiles' | 'sessions';

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'error';

export interface SyncState {
  status: SyncStatus;
  enabled: boolean;
  lastSyncedAt: number | null;
  provider: string | null;
  entities: Record<SyncEntityType, boolean>;
  error: string | null;
}

/**
 * The wire representation of a syncable object. Backends implement the
 * `SyncProvider` interface (see `main/services/sync`) to push/pull these; the
 * `revision` acts as a Lamport clock for last-writer-wins conflict resolution.
 */
export interface SyncRecord<T = unknown> {
  id: string;
  type: SyncEntityType;
  payload: T;
  updatedAt: number;
  deleted: boolean;
  revision: number;
}
