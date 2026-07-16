import type { BlockedResourceKind } from '@shared/types';
import { getHostname } from '@shared/utils';
import { DEFAULT_BLOCKLIST } from './default-blocklist';

export interface BlockMatch {
  blocked: boolean;
  kind?: BlockedResourceKind;
  host?: string;
}

/**
 * A fast domain-based blocking matcher. A request is blocked if its hostname —
 * or any of its parent domains — is present in the blocklist, so a single
 * `doubleclick.net` entry covers `stats.g.doubleclick.net` and friends.
 *
 * Lookups are O(number of dot-separated labels), independent of list size.
 */
export class BlockEngine {
  private readonly rules = new Map<string, BlockedResourceKind>();

  constructor(seed: boolean = true) {
    if (seed) this.loadEntries(DEFAULT_BLOCKLIST);
  }

  get size(): number {
    return this.rules.size;
  }

  add(host: string, kind: BlockedResourceKind): void {
    const normalized = host.trim().toLowerCase();
    if (normalized) this.rules.set(normalized, kind);
  }

  loadEntries(entries: ReadonlyArray<readonly [string, BlockedResourceKind]>): void {
    for (const [host, kind] of entries) this.add(host, kind);
  }

  /**
   * Parse a hosts-format or plain-domain-list blob (one domain per line, `#`
   * comments, optional `0.0.0.0`/`127.0.0.1` prefixes) as trackers.
   */
  loadHostsList(text: string, kind: BlockedResourceKind = 'tracker'): number {
    let added = 0;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('!')) continue;
      const parts = line.split(/\s+/);
      const host = (parts.length > 1 ? parts[1] : parts[0])!.replace(/^\|+|\^$/g, '');
      if (host && host !== 'localhost' && host.includes('.')) {
        this.add(host, kind);
        added += 1;
      }
    }
    return added;
  }

  match(url: string): BlockMatch {
    const host = getHostname(url).toLowerCase();
    if (!host) return { blocked: false };

    const labels = host.split('.');
    for (let i = 0; i < labels.length - 1; i += 1) {
      const candidate = labels.slice(i).join('.');
      const kind = this.rules.get(candidate);
      if (kind) return { blocked: true, kind, host: candidate };
    }
    return { blocked: false };
  }
}
