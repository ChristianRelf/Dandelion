import type { SearchEngineId } from './ids';
import type { AiProviderId } from './ai';

export type ThemeMode = 'light' | 'dark' | 'oled' | 'system';
export type TabLayout = 'vertical' | 'horizontal';
export type UiDensity = 'comfortable' | 'compact';

export interface AppearanceSettings {
  themeMode: ThemeMode;
  accentColor: string;
  /** When true, the active workspace's accent overrides {@link accentColor}. */
  followWorkspaceAccent: boolean;
  /** Glass/backdrop blur strength, 0–100. */
  blurIntensity: number;
  /** Enable window vibrancy/acrylic transparency where the OS supports it. */
  transparency: boolean;
  density: UiDensity;
  fontFamily: string;
  /** UI zoom multiplier, 0.8–1.4. */
  uiScale: number;
  reduceMotion: boolean;
  showTabThumbnails: boolean;
  /** Corner-radius scale in px applied to chrome surfaces. */
  cornerRadius: number;
}

export interface BehaviorSettings {
  restoreSession: 'always' | 'never' | 'ask';
  newTabPage: string;
  homePage: string;
  downloadDirectory: string | null;
  askWhereToSaveDownloads: boolean;
  defaultTabLayout: TabLayout;
  confirmCloseMultipleTabs: boolean;
  warnOnQuitWithTabs: boolean;
}

export interface TabManagementSettings {
  sleepEnabled: boolean;
  sleepAfterMinutes: number;
  sleepPinnedTabs: boolean;
  maxTabsBeforeWarning: number;
  hoverPreview: boolean;
}

export interface SearchSettings {
  defaultEngineId: SearchEngineId;
  searchSuggestions: boolean;
  showHistorySuggestions: boolean;
  showBookmarkSuggestions: boolean;
  enableCalculator: boolean;
  enableUnitConversion: boolean;
  enableWeather: boolean;
  enableAiSuggestions: boolean;
  inlineAutocomplete: boolean;
}

export interface SecureDnsSettings {
  enabled: boolean;
  mode: 'automatic' | 'custom';
  provider: string;
  customUrl: string;
}

export interface ClearDataOptions {
  history: boolean;
  cookies: boolean;
  cache: boolean;
  downloads: boolean;
  formData: boolean;
  passwords: boolean;
}

export interface PrivacySettings {
  blockAds: boolean;
  blockTrackers: boolean;
  blockFingerprinting: boolean;
  blockThirdPartyCookies: boolean;
  httpsUpgrade: boolean;
  httpsOnlyMode: boolean;
  secureDns: SecureDnsSettings;
  doNotTrack: boolean;
  globalPrivacyControl: boolean;
  clearOnExit: ClearDataOptions;
}

export interface SecuritySettings {
  safeBrowsing: boolean;
  safeBrowsingLevel: 'standard' | 'enhanced';
  warnOnInsecureForms: boolean;
  scanDownloads: boolean;
  isolateSites: boolean;
}

export interface AiSettings {
  enabled: boolean;
  defaultProvider: AiProviderId;
  sidebarEnabled: boolean;
  streamResponses: boolean;
  /** Provider base-URL overrides (never secrets — API keys live in the vault). */
  endpoints: Record<string, string>;
}

export interface ShortcutBinding {
  /** Command identifier the binding invokes. */
  action: string;
  /** Accelerator string, e.g. `CmdOrCtrl+Shift+T`. */
  keys: string;
  enabled: boolean;
}

/**
 * The full, versioned settings document. Persisted per profile; the `version`
 * drives forward-migrations in the settings store.
 */
export interface Settings {
  version: number;
  appearance: AppearanceSettings;
  behavior: BehaviorSettings;
  tabs: TabManagementSettings;
  search: SearchSettings;
  privacy: PrivacySettings;
  security: SecuritySettings;
  ai: AiSettings;
  shortcuts: ShortcutBinding[];
}

/** A per-section partial used for patch updates over IPC. Array-valued sections
 * (e.g. `shortcuts`) are replaced wholesale rather than made partial. */
export type SettingsPatch = {
  [K in keyof Settings]?: Settings[K] extends readonly unknown[]
    ? Settings[K]
    : Settings[K] extends object
      ? Partial<Settings[K]>
      : Settings[K];
};
