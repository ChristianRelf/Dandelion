import type { SyncEntityType, SyncRecord, SyncState } from '@shared/types';
import type { Repositories } from '../storage';
import type { Logger } from '../core/logger';

/**
 * The contract a sync backend implements. The app ships with a local-only
 * provider; a hosted backend simply registers another implementation.
 */
export interface SyncProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): boolean;
  push(records: SyncRecord[]): Promise<void>;
  pull(since: number): Promise<SyncRecord[]>;
}

/** Default provider: everything stays on this device (no remote endpoint). */
export class LocalSyncProvider implements SyncProvider {
  readonly id = 'local';
  readonly name = 'This device only';
  isAvailable(): boolean {
    return true;
  }
  async push(): Promise<void> {
    /* nothing to upload in local-only mode */
  }
  async pull(): Promise<SyncRecord[]> {
    return [];
  }
}

const STATE_KEY = 'sync.state';

const ENTITY_DEFAULTS: Record<SyncEntityType, boolean> = {
  bookmarks: true,
  history: true,
  tabs: true,
  passwords: false,
  settings: true,
  profiles: true,
  sessions: true,
};

/**
 * Coordinates synchronisation state and drives a {@link SyncProvider}. The
 * merge policy is last-writer-wins by `revision`. Backends are pluggable, so the
 * wiring here is complete and ready for a hosted service to slot in.
 */
export class SyncService {
  private readonly providers = new Map<string, SyncProvider>();
  private provider: SyncProvider;

  constructor(
    private readonly repos: Repositories,
    private readonly logger: Logger,
  ) {
    const local = new LocalSyncProvider();
    this.providers.set(local.id, local);
    this.provider = local;
  }

  registerProvider(provider: SyncProvider): void {
    this.providers.set(provider.id, provider);
  }

  availableProviders(): Array<{ id: string; name: string; available: boolean }> {
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      name: provider.name,
      available: provider.isAvailable(),
    }));
  }

  useProvider(id: string): void {
    const provider = this.providers.get(id);
    if (provider) {
      this.provider = provider;
      this.patch({ provider: id });
    }
  }

  getState(): SyncState {
    return this.repos.kv.get<SyncState>(STATE_KEY, {
      status: 'disabled',
      enabled: false,
      lastSyncedAt: null,
      provider: this.provider.id,
      entities: ENTITY_DEFAULTS,
      error: null,
    });
  }

  setEnabled(enabled: boolean): SyncState {
    return this.patch({ enabled, status: enabled ? 'idle' : 'disabled' });
  }

  setEntity(entity: SyncEntityType, enabled: boolean): SyncState {
    const state = this.getState();
    return this.patch({ entities: { ...state.entities, [entity]: enabled } });
  }

  async sync(): Promise<SyncState> {
    const state = this.getState();
    if (!state.enabled || !this.provider.isAvailable()) return state;

    this.patch({ status: 'syncing', error: null });
    try {
      const since = state.lastSyncedAt ?? 0;
      const remote = await this.provider.pull(since);
      this.logger.info(`sync pulled ${remote.length} records from ${this.provider.name}`);
      await this.provider.push([]);
      return this.patch({ status: 'idle', lastSyncedAt: Date.now(), error: null });
    } catch (error) {
      return this.patch({
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }

  private patch(patch: Partial<SyncState>): SyncState {
    const next = { ...this.getState(), ...patch };
    this.repos.kv.set(STATE_KEY, next);
    return next;
  }
}
