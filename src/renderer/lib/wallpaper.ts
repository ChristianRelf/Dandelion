import type { WorkspaceWallpaper } from '@shared/types';
import { wallpaperUrl } from '@shared/utils';

/**
 * The `background` shorthand a wallpaper paints.
 *
 * Safe to interpolate because `wallpaperSchema` pins each kind's grammar on the
 * way in: a colour is a hex triplet, a gradient is two hex stops and an angle,
 * and an image is a file name this browser invented — so none of them can carry
 * a `url(...)` or close the declaration.
 */
export function wallpaperBackground(wallpaper: WorkspaceWallpaper): string {
  switch (wallpaper.kind) {
    case 'color':
    case 'gradient':
      return wallpaper.value;
    case 'image':
      return `center / cover no-repeat url("${wallpaperUrl(wallpaper.value)}")`;
  }
}

/**
 * The CSS filter for a wallpaper's blur, or `undefined` when it has none.
 *
 * The slider is 0–100 but a 100px blur is a flat wash; a fifth of it reads as
 * the whole range without the top half being indistinguishable.
 */
export function wallpaperBlur(wallpaper: WorkspaceWallpaper): string | undefined {
  return wallpaper.blur > 0 ? `blur(${wallpaper.blur / 5}px)` : undefined;
}
