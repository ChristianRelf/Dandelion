import { dialog } from 'electron';
import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { WALLPAPER_EXTENSIONS, WALLPAPER_FILE_RE } from '@shared/constants';
import { createShortId } from '@shared/utils';
import type { Logger } from '../core/logger';
import { wallpapersDir } from '../core/paths';

/**
 * Owns the image files behind `kind: 'image'` wallpapers.
 *
 * A wallpaper image cannot simply be referenced where the user left it. The
 * chrome's CSP allows `img-src 'self' data: blob: dandelion-media:` and no
 * `file:`, so a path on disk is unrenderable; and a path *would* still be a
 * path — outliving the file, breaking when the user tidies their Pictures
 * folder, and pointing anywhere at all if it ever arrived from somewhere other
 * than the picker.
 *
 * So the picked file is copied in here under a name this service invents, and
 * that name is all the database ever stores. Serving is by name only
 * ({@link resolve}), which is what makes the media protocol's wallpaper branch
 * safe: there is no caller-supplied path anywhere in the path.
 */
export class WallpaperService {
  constructor(private readonly logger: Logger) {}

  /**
   * Ask for an image and copy it in. Returns the stored file name, or `null` if
   * the user cancelled.
   */
  async pick(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Choose a wallpaper',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: [...WALLPAPER_EXTENSIONS] }],
    });
    const source = result.filePaths[0];
    if (result.canceled || !source) return null;

    // The dialog's filter is a hint to the user, not a guarantee to us.
    const extension = extname(source).slice(1).toLowerCase();
    if (!(WALLPAPER_EXTENSIONS as readonly string[]).includes(extension)) {
      this.logger.warn(`refused a wallpaper with extension "${extension}"`);
      return null;
    }

    const fileName = `wp_${createShortId(16)}.${extension}`;
    await mkdir(wallpapersDir(), { recursive: true });
    await copyFile(source, join(wallpapersDir(), fileName));
    this.logger.info(`stored wallpaper ${fileName}`);
    return fileName;
  }

  /**
   * The absolute path of a stored wallpaper, or `null` if `fileName` is not one
   * of ours. The regex is the containment check: a name that matches cannot
   * contain a separator, a colon or a dot-segment, so the join cannot leave the
   * directory.
   */
  resolve(fileName: string): string | null {
    if (!WALLPAPER_FILE_RE.test(fileName)) return null;
    return join(wallpapersDir(), fileName);
  }

  /**
   * Delete stored images no space is wearing any more.
   *
   * Called after a wallpaper changes rather than deleting the old file inline,
   * because two spaces may share one image and the workspace rows are the only
   * record of who still wants it.
   */
  async collectGarbage(inUse: Iterable<string>): Promise<void> {
    const keep = new Set(inUse);
    let files: string[];
    try {
      files = await readdir(wallpapersDir());
    } catch {
      // No directory yet means nothing to collect.
      return;
    }

    for (const file of files) {
      if (keep.has(file) || !WALLPAPER_FILE_RE.test(file)) continue;
      try {
        await unlink(join(wallpapersDir(), file));
        this.logger.debug(`removed unused wallpaper ${file}`);
      } catch (error) {
        // Housekeeping: a file we cannot delete is a wasted megabyte, not a
        // reason to fail the change the user asked for.
        this.logger.warn(`could not remove unused wallpaper ${file}`, error);
      }
    }
  }
}
