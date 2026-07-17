import { z } from 'zod';
import { GRADIENT_RE, WALLPAPER_FILE_RE } from '../constants/wallpapers';
import { zHexColor, zId } from './common';

/**
 * A wallpaper's `value` is rendered into `background-image` / `background-color`
 * in the chrome, where `style-src` allows `'unsafe-inline'`. An unconstrained
 * string would therefore be a CSS injection sink, so each kind validates the
 * only grammar it is allowed to be rather than sharing one `z.string()`:
 *
 * - `color`    a hex colour
 * - `gradient` two hex stops and an angle — never arbitrary CSS, so no `url()`
 * - `image`    the file name of its copy in the wallpapers directory, never a
 *              caller-supplied path (see `WallpaperService`)
 */
const wallpaperLayer = { blur: z.number().min(0).max(100), dim: z.number().min(0).max(1) };

const wallpaperSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('color'), value: zHexColor, ...wallpaperLayer }),
  z.object({
    kind: z.literal('gradient'),
    value: z.string().regex(GRADIENT_RE),
    ...wallpaperLayer,
  }),
  z.object({
    kind: z.literal('image'),
    value: z.string().regex(WALLPAPER_FILE_RE),
    ...wallpaperLayer,
  }),
]);

export const createWorkspaceInput = z.object({
  profileId: zId,
  name: z.string().min(1).max(80),
  icon: z.string().default('sparkles'),
  accentColor: zHexColor,
});
export const updateWorkspaceInput = z.object({
  workspaceId: zId,
  name: z.string().min(1).max(80).optional(),
  icon: z.string().optional(),
  accentColor: zHexColor.optional(),
  wallpaper: wallpaperSchema.nullable().optional(),
});
export const workspaceRef = z.object({ workspaceId: zId });
export const reorderWorkspacesInput = z.object({ orderedIds: z.array(zId) });

export const createProfileInput = z.object({
  name: z.string().min(1).max(80),
  color: zHexColor,
  avatar: z.string().nullable().default(null),
  isPrivate: z.boolean().default(false),
});
export const updateProfileInput = z.object({
  profileId: zId,
  name: z.string().min(1).max(80).optional(),
  color: zHexColor.optional(),
  avatar: z.string().nullable().optional(),
});
export const profileRef = z.object({ profileId: zId });
