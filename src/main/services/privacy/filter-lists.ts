import { createRequire } from 'node:module';
import type { BlockedResourceKind } from '@shared/types';

/**
 * The filter-list catalogue, grouped by the shield category each list feeds.
 *
 * The grouping is the reason there is one engine per category rather than one
 * merged engine: a merged engine returns a single verdict, which cannot say
 * whether a blocked request was an ad or a tracker, and cannot honour
 * `blockAds` being on while `blockTrackers` is off. Keeping the lists apart
 * keeps both the toggles and the shield counters exact.
 *
 * All sources are the canonical upstream URLs in Adblock Plus filter syntax.
 * They are fetched at runtime and cached; see `filter-engine.ts`.
 */
export const FILTER_LISTS: Readonly<Record<FilterCategory, readonly string[]>> = {
  ad: [
    'https://easylist.to/easylist/easylist.txt',
    'https://ublockorigin.github.io/uAssets/filters/filters.txt',
    'https://ublockorigin.github.io/uAssets/filters/annoyances-others.txt',
  ],
  tracker: [
    'https://easylist.to/easylist/easyprivacy.txt',
    'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
  ],
  fingerprinter: [
    'https://ublockorigin.github.io/uAssets/filters/badware.txt',
    'https://ublockorigin.github.io/uAssets/filters/resource-abuse.txt',
  ],
} as const;

/**
 * Scriptlet and redirect resources used by `+js(...)` and `$redirect=` rules.
 * Without these a scriptlet filter parses but has nothing to inject, so the
 * anti-adblock and popup-defusing rules in the lists above silently do nothing.
 *
 * The URL is pinned to the tag of the `@ghostery/adblocker` release actually
 * installed, rather than to a branch: the resources file is parsed by that
 * package's own reader, so a newer format than the installed parser understands
 * is rejected wholesale. Deriving the tag from the installed version means the
 * two cannot drift when the dependency is upgraded.
 */
export function filterResourcesUrl(): string {
  const version = installedAdblockerVersion();
  return (
    `https://raw.githubusercontent.com/ghostery/adblocker/v${version}` +
    '/packages/adblocker/assets/ublock-origin/resources.json'
  );
}

function installedAdblockerVersion(): string {
  const manifest = createRequire(__filename)('@ghostery/adblocker/package.json') as {
    version?: string;
  };
  const version = manifest.version;
  if (!version) throw new Error('@ghostery/adblocker package.json has no version');
  return version;
}

/**
 * Categories backed by downloadable filter lists.
 *
 * `cryptominer` is deliberately absent: it has no list of its own and is
 * already covered by the resource-abuse list under `fingerprinter`.
 */
export type FilterCategory = Extract<BlockedResourceKind, 'ad' | 'tracker' | 'fingerprinter'>;

export const FILTER_CATEGORIES: readonly FilterCategory[] = ['ad', 'tracker', 'fingerprinter'];

/**
 * How long a cached engine is served before a refresh is started. Upstream
 * lists publish roughly daily; refreshing more often costs bandwidth without
 * changing verdicts, and refreshing much less often lets sites that ship new
 * ad domains go unblocked for weeks.
 */
export const FILTER_REFRESH_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Identifies the list set an on-disk engine was built from. A cached engine
 * whose signature no longer matches the catalogue is stale by construction —
 * the lists changed in an app update — and is rebuilt rather than trusted.
 */
export function listSignature(category: FilterCategory): string {
  return FILTER_LISTS[category].join('|');
}
