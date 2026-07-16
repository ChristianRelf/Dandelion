import type { ProfileId, WorkspaceId } from './ids';

export type WallpaperKind = 'color' | 'gradient' | 'image';

export interface WorkspaceWallpaper {
  kind: WallpaperKind;
  /** Hex colour, CSS gradient string, or image path / data URL. */
  value: string;
  /** Backdrop blur intensity applied over the wallpaper, 0–100. */
  blur: number;
  /** Overlay opacity applied for legibility, 0–1. */
  dim: number;
}

/**
 * An Arc-style "Space": an organisational and visual container for a set of
 * tabs. A workspace references exactly one {@link Profile}; several workspaces
 * may share a profile (and therefore its cookie jar) or each may have its own.
 */
export interface Workspace {
  id: WorkspaceId;
  profileId: ProfileId;
  name: string;
  /** Emoji or Lucide icon name shown in the workspace switcher. */
  icon: string;
  /** Accent colour (hex) that themes the chrome while this workspace is active. */
  accentColor: string;
  wallpaper: WorkspaceWallpaper | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}
