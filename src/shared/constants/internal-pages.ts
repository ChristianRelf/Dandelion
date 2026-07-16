import { APP_SCHEME } from './app';

/**
 * Internal pages are rendered by the React chrome itself (not by a
 * `WebContentsView`). Navigating a tab to one of these URLs swaps the web
 * content region for the corresponding in-app page.
 */
export const INTERNAL_PAGES = {
  newTab: `${APP_SCHEME}://newtab`,
  settings: `${APP_SCHEME}://settings`,
  history: `${APP_SCHEME}://history`,
  downloads: `${APP_SCHEME}://downloads`,
  bookmarks: `${APP_SCHEME}://bookmarks`,
  passwords: `${APP_SCHEME}://passwords`,
  permissions: `${APP_SCHEME}://permissions`,
  cookies: `${APP_SCHEME}://cookies`,
  extensions: `${APP_SCHEME}://extensions`,
  about: `${APP_SCHEME}://about`,
} as const;

export type InternalPageKey = keyof typeof INTERNAL_PAGES;

const PREFIX = `${APP_SCHEME}://`;

export function isInternalUrl(url: string): boolean {
  return url.startsWith(PREFIX);
}

/** Resolve a `dandelion://` URL to its page key (ignoring path/query), or `null`. */
export function internalPageOf(url: string): InternalPageKey | null {
  if (!isInternalUrl(url)) return null;
  const host = url.slice(PREFIX.length).split(/[/?#]/)[0];
  const match = (Object.keys(INTERNAL_PAGES) as InternalPageKey[]).find(
    (key) => INTERNAL_PAGES[key] === `${PREFIX}${host}`,
  );
  return match ?? null;
}
