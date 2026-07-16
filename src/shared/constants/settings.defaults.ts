import type { Settings } from '../types/settings';
import { DEFAULT_SEARCH_ENGINE_ID } from './search-engines';
import { DEFAULT_SHORTCUTS } from './commands';
import { INTERNAL_PAGES } from './internal-pages';

/** Current settings schema version. Bump when adding a migration. */
export const SETTINGS_VERSION = 1;

/** Curated default accent — a warm dandelion gold. */
export const DEFAULT_ACCENT = '#f5c451';

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  appearance: {
    themeMode: 'system',
    accentColor: DEFAULT_ACCENT,
    followWorkspaceAccent: true,
    blurIntensity: 60,
    transparency: true,
    density: 'comfortable',
    fontFamily: 'Inter',
    uiScale: 1,
    reduceMotion: false,
    showTabThumbnails: true,
    cornerRadius: 12,
  },
  behavior: {
    restoreSession: 'ask',
    newTabPage: INTERNAL_PAGES.newTab,
    homePage: INTERNAL_PAGES.newTab,
    downloadDirectory: null,
    askWhereToSaveDownloads: false,
    defaultTabLayout: 'vertical',
    confirmCloseMultipleTabs: true,
    warnOnQuitWithTabs: true,
    automaticUpdates: true,
  },
  tabs: {
    sleepEnabled: true,
    sleepAfterMinutes: 30,
    sleepPinnedTabs: false,
    maxTabsBeforeWarning: 80,
    hoverPreview: true,
  },
  search: {
    defaultEngineId: DEFAULT_SEARCH_ENGINE_ID,
    searchSuggestions: true,
    showHistorySuggestions: true,
    showBookmarkSuggestions: true,
    enableCalculator: true,
    enableUnitConversion: true,
    enableTimezoneConversion: true,
    enableClipboardSuggestions: true,
    enableWeather: false,
    enableAiSuggestions: false,
    inlineAutocomplete: true,
  },
  privacy: {
    blockAds: true,
    blockTrackers: true,
    blockFingerprinting: true,
    blockThirdPartyCookies: true,
    httpsUpgrade: true,
    httpsOnlyMode: false,
    secureDns: {
      enabled: false,
      mode: 'automatic',
      provider: 'Cloudflare',
      customUrl: 'https://cloudflare-dns.com/dns-query',
    },
    doNotTrack: true,
    globalPrivacyControl: true,
    clearOnExit: {
      history: false,
      cookies: false,
      cache: false,
      downloads: false,
      formData: false,
      passwords: false,
    },
  },
  security: {
    safeBrowsing: true,
    safeBrowsingLevel: 'standard',
    warnOnInsecureForms: true,
    scanDownloads: true,
    isolateSites: true,
  },
  ai: {
    enabled: true,
    defaultProvider: 'anthropic',
    sidebarEnabled: true,
    streamResponses: true,
    endpoints: {},
  },
  shortcuts: [...DEFAULT_SHORTCUTS],
};

/** Deep clone of the defaults, safe to mutate for a fresh profile. */
export function createDefaultSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS);
}
