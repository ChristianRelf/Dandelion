import type { Settings, SettingsPatch } from '@shared/types';
import { createDefaultSettings, SETTINGS_VERSION } from '@shared/constants';
import type { Repositories } from '../storage';
import type { EventBus } from '../core/event-bus';
import { deepMerge } from '../core/merge';

const GLOBAL_SCOPE = '__global__';

type SettingsListener = (settings: Settings) => void;

/**
 * Owns the application settings document: load-with-defaults, forward migration,
 * patch-and-persist, and change notification. Settings are cached in memory and
 * written through to SQLite on every update.
 */
export class SettingsService {
  private cache: Settings | null = null;
  private readonly listeners = new Set<SettingsListener>();

  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
  ) {}

  load(): Settings {
    if (this.cache) return this.cache;
    const stored = this.repos.settings.get(GLOBAL_SCOPE);
    const settings = stored ? this.migrate(stored) : createDefaultSettings();
    this.cache = settings;
    if (!stored) this.repos.settings.set(GLOBAL_SCOPE, settings);
    return settings;
  }

  get(): Settings {
    return this.load();
  }

  update(patch: SettingsPatch): Settings {
    const next = deepMerge(this.load(), patch);
    next.version = SETTINGS_VERSION;
    this.repos.settings.set(GLOBAL_SCOPE, next);
    this.cache = next;
    this.notify(next);
    return next;
  }

  reset(): Settings {
    const defaults = createDefaultSettings();
    this.repos.settings.set(GLOBAL_SCOPE, defaults);
    this.cache = defaults;
    this.notify(defaults);
    return defaults;
  }

  onChange(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(settings: Settings): void {
    for (const listener of this.listeners) listener(settings);
    // Settings changes are surfaced to the renderer via the app:command channel
    // by callers that need it; low-level listeners handle session reconfig.
    void this.events;
  }

  /** Merge stored settings over current defaults so new keys are always present. */
  private migrate(stored: Settings): Settings {
    const merged = deepMerge(createDefaultSettings(), stored as SettingsPatch);
    merged.version = SETTINGS_VERSION;
    return merged;
  }
}
