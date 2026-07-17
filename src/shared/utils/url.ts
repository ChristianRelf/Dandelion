/**
 * URL classification and normalisation used by the omnibox to distinguish a
 * navigable address from a search query, and to render URLs cleanly.
 */
import { MEDIA_SCHEME } from '../constants/app';

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

const KNOWN_SCHEMES = new Set([
  'http:',
  'https:',
  'file:',
  'ftp:',
  'about:',
  'dandelion:',
  'data:',
  'blob:',
  'chrome:',
  'view-source:',
  'mailto:',
]);

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Does the input begin with a genuine URL scheme? A scheme only counts when it
 * is followed by `//` (e.g. `https://`, `dandelion://`) or is a known
 * scheme keyword (e.g. `mailto:`). This prevents `localhost:5173` and
 * `example.com:8080` from being mistaken for schemes.
 */
export function hasScheme(input: string): boolean {
  const match = input.match(SCHEME_RE);
  if (!match) return false;
  const scheme = match[1]!.toLowerCase();
  const rest = input.slice(match[0].length);
  return rest.startsWith('//') || KNOWN_SCHEMES.has(`${scheme}:`);
}

/** Heuristic: does this input denote an address rather than a search query? */
export function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (hasScheme(trimmed)) return true;

  const authority = trimmed.split(/[/?#]/)[0] ?? trimmed;
  const host = authority.split(':')[0] ?? authority; // strip any port
  if (host === 'localhost') return true;
  if (IPV4_RE.test(host)) return true;
  if (!host.includes('.')) return false;

  const labels = host.split('.');
  const tld = labels[labels.length - 1] ?? '';
  if (!/^[a-z]{2,24}$/i.test(tld)) return false;
  return labels.every((label) => label.length > 0 && /^[a-z0-9-]+$/i.test(label));
}

/** Prepend a sensible scheme to a schemeless address. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (hasScheme(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export type OmniboxIntent = { kind: 'url'; url: string } | { kind: 'search'; query: string };

/** Decide whether raw omnibox text should navigate or search. */
export function classifyOmniboxInput(input: string): OmniboxIntent {
  const trimmed = input.trim();
  if (looksLikeUrl(trimmed)) return { kind: 'url', url: normalizeUrl(trimmed) };
  return { kind: 'search', query: trimmed };
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function getOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Address the chrome uses to render a site's favicon, resolved by main through
 * the profile's own session. Returns `null` for anything that is not a remote
 * URL — a data URL or a missing icon needs no indirection.
 */
export function mediaUrl(profileId: string, url: string | null): string | null {
  if (!url) return null;
  if (!/^https?:/i.test(url)) return url;
  return `${MEDIA_SCHEME}://icon?profile=${encodeURIComponent(profileId)}&url=${encodeURIComponent(url)}`;
}

/**
 * Whether a URL is something **web content** may ask the browser to open.
 *
 * The chrome may navigate anywhere, including `dandelion://` internal pages — a
 * page may not. `window.open('dandelion://passwords')` would otherwise reach
 * `loadURL` from the main process and render the internal password manager,
 * with Chromium's renderer-side scheme rules never in the path to stop it. So
 * the allowlist has to live wherever a page-supplied URL is accepted.
 *
 * `about:blank` is included because a popup opener writes into it directly —
 * OAuth flows do — and it carries no content of its own.
 */
export function isWebContentUrl(url: string): boolean {
  if (url === 'about:blank') return true;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Strip protocol and trailing slash for a clean, human-readable address. */
export function prettifyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.host}${path}${parsed.search}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

/** Substitute a query into a `%s` search template. */
export function buildSearchUrl(template: string, query: string): string {
  return template.replace('%s', encodeURIComponent(query));
}

/**
 * Reduce a hostname to its registrable-ish root, for **display and grouping
 * only**.
 *
 * Best-effort by construction: it counts labels, and no count is right for
 * every suffix. `bbc.co.uk` and `tracker.co.uk` both reduce to `co.uk`, which
 * is harmless when captioning a list and wrong when deciding who may read a
 * cookie — it once backed the third-party shield and silently failed it open on
 * every multi-part TLD.
 *
 * Anything load-bearing wants a real registrable domain from the Public Suffix
 * List: `registrableDomain` in `main/services/privacy/public-suffix.ts`. It is
 * not here because the list is ~140KB and no renderer needs it.
 */
export function rootDomain(hostname: string): string {
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) return hostname;
  return labels.slice(-2).join('.');
}
