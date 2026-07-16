import type { Settings } from '@shared/types';

/** Choose a readable foreground (dark/light) for a given accent background. */
function contrastColor(hex: string): string {
  const value = hex.replace('#', '');
  if (value.length < 6) return '#1a1205';
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1205' : '#ffffff';
}

function resolveMode(mode: Settings['appearance']['themeMode']): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode === 'oled' ? 'dark' : mode;
}

function setVar(root: HTMLElement, name: string, value: string): void {
  if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
}

/**
 * Apply the appearance settings to the document root. A single call reskins the
 * entire UI through the CSS-variable design tokens. Writes are diffed so
 * re-applying identical settings never touches the DOM (and never reflows).
 */
export function applyAppearance(settings: Settings, accent: string): void {
  const root = document.documentElement;
  const appearance = settings.appearance;

  const mode = resolveMode(appearance.themeMode);
  if (root.dataset.theme !== mode) root.dataset.theme = mode;
  const oled = String(appearance.themeMode === 'oled');
  if (root.dataset.oled !== oled) root.dataset.oled = oled;
  if (root.dataset.density !== appearance.density) root.dataset.density = appearance.density;
  const reduce = String(appearance.reduceMotion);
  if (root.dataset.reduceMotion !== reduce) root.dataset.reduceMotion = reduce;

  setVar(root, '--accent', accent);
  setVar(root, '--accent-fg', contrastColor(accent));
  setVar(root, '--radius-scale', (Math.max(0, appearance.cornerRadius) / 12).toFixed(3));

  // Transparency toggles glass on/off: when disabled, panels become fully
  // opaque with no blur so the interface reads as solid.
  if (appearance.transparency) {
    setVar(root, '--glass-blur', `${Math.round((appearance.blurIntensity / 100) * 32)}px`);
    setVar(root, '--glass-opacity', '72%');
    setVar(root, '--glass-opacity-strong', '86%');
  } else {
    setVar(root, '--glass-blur', '0px');
    setVar(root, '--glass-opacity', '100%');
    setVar(root, '--glass-opacity-strong', '100%');
  }

  // fontSize is the only property here that forces a reflow — guard it.
  const fontSize = `${Math.round(appearance.uiScale * 100)}%`;
  if (root.style.fontSize !== fontSize) root.style.fontSize = fontSize;
}

/**
 * Subscribe to OS light/dark changes. The handler fires only when the setting
 * is following the system, so the theme flips live without a settings round-trip.
 * Returns an unsubscribe function.
 */
export function watchSystemTheme(handler: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
