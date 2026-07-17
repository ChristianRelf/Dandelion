import type { WorkspaceWallpaper } from '../types/workspace';

/**
 * The exact shape of every gradient this browser will render.
 *
 * A wallpaper's `value` reaches `background-image` in the chrome renderer, and
 * `style-src` allows `'unsafe-inline'` — so an arbitrary CSS string here would
 * be a sink. Pinning the grammar to two hex stops and an angle means a stored
 * value can express a gradient and nothing else: no `url(...)`, no second
 * declaration, no escape.
 */
export const GRADIENT_RE = /^linear-gradient\((\d{1,3})deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/i;

/** Image wallpapers store the file name of their copy in the wallpapers dir. */
export const WALLPAPER_FILE_RE = /^wp_[a-z0-9]{8,32}\.(jpg|jpeg|png|webp|avif|gif)$/i;

/** Extensions accepted from the file picker, and the only ones ever served. */
export const WALLPAPER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'] as const;

export const gradient = (angle: number, from: string, to: string): string =>
  `linear-gradient(${angle}deg, ${from}, ${to})`;

/** Curated gradients, in the house palette. */
export const GRADIENT_PRESETS: readonly { id: string; label: string; value: string }[] = [
  { id: 'dandelion', label: 'Dandelion', value: gradient(135, '#f5c451', '#fb923c') },
  { id: 'dusk', label: 'Dusk', value: gradient(135, '#a78bfa', '#f472b6') },
  { id: 'meadow', label: 'Meadow', value: gradient(135, '#4ade80', '#22d3ee') },
  { id: 'tide', label: 'Tide', value: gradient(135, '#60a5fa', '#a78bfa') },
  { id: 'ember', label: 'Ember', value: gradient(135, '#f87171', '#f5c451') },
  { id: 'slate', label: 'Slate', value: gradient(135, '#64748b', '#1e293b') },
];

/** Curated flat colours, mirroring the accent swatches in the space menu. */
export const COLOR_PRESETS: readonly string[] = [
  '#f5c451',
  '#60a5fa',
  '#4ade80',
  '#f472b6',
  '#a78bfa',
  '#22d3ee',
  '#fb923c',
  '#f87171',
  '#64748b',
  '#1e293b',
];

/** What a space gets the first time a wallpaper is chosen for it. */
export const DEFAULT_WALLPAPER: WorkspaceWallpaper = {
  kind: 'gradient',
  value: GRADIENT_PRESETS[0]?.value ?? gradient(135, '#f5c451', '#fb923c'),
  blur: 0,
  dim: 0.1,
};
