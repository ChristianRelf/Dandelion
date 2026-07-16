export const APP_NAME = 'Dandelion';
export const APP_ID = 'browser.dandelion.app';

/** Custom URL scheme for internal pages, e.g. `dandelion://settings`. */
export const APP_SCHEME = 'dandelion';

/** Fallback version; the main process prefers `app.getVersion()`. */
export const APP_VERSION = '0.1.0';

export const WINDOW_DEFAULTS = {
  width: 1360,
  height: 860,
  minWidth: 680,
  minHeight: 480,
  /** Height of the draggable custom title bar region, in px. */
  titleBarHeight: 40,
} as const;
