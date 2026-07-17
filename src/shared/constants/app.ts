export const APP_NAME = 'Dandelion';
export const APP_ID = 'browser.dandelion.app';

/** Custom URL scheme for internal pages, e.g. `dandelion://settings`. */
export const APP_SCHEME = 'dandelion';

/**
 * Scheme the chrome loads favicons through, e.g.
 * `dandelion-favicon://icon?profile=<id>&url=<encoded>`.
 *
 * The chrome window has no session of its own, so it renders in the **default**
 * session. Pointing an `<img>` at a site-chosen favicon URL therefore fetched it
 * outside every profile partition — a persistent jar shared by all profiles,
 * including private ones, with none of the privacy engine's filters attached.
 * Main resolves this scheme by fetching through the owning profile's session
 * instead, so the request is isolated, blockable, and counted like any other.
 */
export const FAVICON_SCHEME = 'dandelion-favicon';

/** Fallback version; the main process prefers `app.getVersion()`. */
export const APP_VERSION = '0.1.0';

/**
 * GitHub Releases — the same feed `electron-updater` reads (see the `publish`
 * block in `electron-builder.yml`). Used to link a downloaded update to its
 * notes, so the two must keep naming the same repository.
 */
export const APP_RELEASES_URL = 'https://github.com/ChristianRelf/Dandelion/releases';

export const WINDOW_DEFAULTS = {
  width: 1360,
  height: 860,
  minWidth: 680,
  minHeight: 480,
  /** Height of the draggable custom title bar region, in px. */
  titleBarHeight: 40,
} as const;
