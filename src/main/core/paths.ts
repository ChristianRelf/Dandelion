import { join } from 'node:path';
import { app } from 'electron';

/** Root directory for all persistent user data (per platform convention). */
export function userDataDir(): string {
  return app.getPath('userData');
}

/** The main SQLite database file. */
export function databasePath(): string {
  return join(userDataDir(), 'dandelion.db');
}

/** Default download destination. */
export function defaultDownloadsDir(): string {
  return app.getPath('downloads');
}

/** Directory for cached tab thumbnails and other regenerable artefacts. */
export function cacheDir(): string {
  return join(userDataDir(), 'Cache');
}

/**
 * Directory holding this install's copies of user-chosen wallpaper images.
 *
 * Not regenerable — unlike {@link cacheDir}, deleting this loses the picture a
 * space was wearing, because the original file may be long gone.
 */
export function wallpapersDir(): string {
  return join(userDataDir(), 'Wallpapers');
}
