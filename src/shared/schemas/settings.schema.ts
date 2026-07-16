import { z } from 'zod';
import { zHexColor, zId } from './common';

const appearanceSchema = z.object({
  themeMode: z.enum(['light', 'dark', 'oled', 'system']),
  accentColor: zHexColor,
  followWorkspaceAccent: z.boolean(),
  blurIntensity: z.number().min(0).max(100),
  transparency: z.boolean(),
  density: z.enum(['comfortable', 'compact']),
  fontFamily: z.string(),
  uiScale: z.number().min(0.8).max(1.4),
  reduceMotion: z.boolean(),
  showTabThumbnails: z.boolean(),
  cornerRadius: z.number().min(0).max(28),
});

const behaviorSchema = z.object({
  restoreSession: z.enum(['always', 'never', 'ask']),
  newTabPage: z.string(),
  homePage: z.string(),
  downloadDirectory: z.string().nullable(),
  askWhereToSaveDownloads: z.boolean(),
  defaultTabLayout: z.enum(['vertical', 'horizontal']),
  confirmCloseMultipleTabs: z.boolean(),
  warnOnQuitWithTabs: z.boolean(),
  automaticUpdates: z.boolean(),
});

const tabsSchema = z.object({
  sleepEnabled: z.boolean(),
  sleepAfterMinutes: z.number().int().min(1).max(1440),
  sleepPinnedTabs: z.boolean(),
  maxTabsBeforeWarning: z.number().int().min(1),
  hoverPreview: z.boolean(),
});

const searchSchema = z.object({
  defaultEngineId: zId,
  searchSuggestions: z.boolean(),
  showHistorySuggestions: z.boolean(),
  showBookmarkSuggestions: z.boolean(),
  enableCalculator: z.boolean(),
  enableUnitConversion: z.boolean(),
  enableTimezoneConversion: z.boolean(),
  enableClipboardSuggestions: z.boolean(),
  enableWeather: z.boolean(),
  enableAiSuggestions: z.boolean(),
  inlineAutocomplete: z.boolean(),
});

const secureDnsSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['automatic', 'custom']),
  provider: z.string(),
  customUrl: z.string(),
});

const clearDataSchema = z.object({
  history: z.boolean(),
  cookies: z.boolean(),
  cache: z.boolean(),
  downloads: z.boolean(),
  formData: z.boolean(),
  passwords: z.boolean(),
});

const privacySchema = z.object({
  blockAds: z.boolean(),
  blockTrackers: z.boolean(),
  blockFingerprinting: z.boolean(),
  blockThirdPartyCookies: z.boolean(),
  httpsUpgrade: z.boolean(),
  httpsOnlyMode: z.boolean(),
  secureDns: secureDnsSchema,
  doNotTrack: z.boolean(),
  globalPrivacyControl: z.boolean(),
  clearOnExit: clearDataSchema,
});

const securitySchema = z.object({
  safeBrowsing: z.boolean(),
  safeBrowsingLevel: z.enum(['standard', 'enhanced']),
  warnOnInsecureForms: z.boolean(),
  scanDownloads: z.boolean(),
  isolateSites: z.boolean(),
});

const aiSettingsSchema = z.object({
  enabled: z.boolean(),
  defaultProvider: z.string(),
  sidebarEnabled: z.boolean(),
  streamResponses: z.boolean(),
  endpoints: z.record(z.string(), z.string()),
});

const shortcutSchema = z.object({
  action: z.string(),
  keys: z.string(),
  enabled: z.boolean(),
});

export const settingsSchema = z.object({
  version: z.number().int(),
  appearance: appearanceSchema,
  behavior: behaviorSchema,
  tabs: tabsSchema,
  search: searchSchema,
  privacy: privacySchema,
  security: securitySchema,
  ai: aiSettingsSchema,
  shortcuts: z.array(shortcutSchema),
});

/** Shallow-per-section patch used by `settings.update`. */
export const settingsPatchSchema = z.object({
  appearance: appearanceSchema.partial().optional(),
  behavior: behaviorSchema.partial().optional(),
  tabs: tabsSchema.partial().optional(),
  search: searchSchema.partial().optional(),
  privacy: privacySchema.partial().optional(),
  security: securitySchema.partial().optional(),
  ai: aiSettingsSchema.partial().optional(),
  shortcuts: z.array(shortcutSchema).optional(),
});

export const updateShortcutInput = z.object({
  action: z.string(),
  keys: z.string(),
  enabled: z.boolean().default(true),
});
