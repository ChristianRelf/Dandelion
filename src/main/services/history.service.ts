import type { HistoryEntry, VisitTransition } from '@shared/types';
import { isInternalUrl, LIMITS } from '@shared/constants';
import type { Repositories } from '../storage';

function isRecordable(url: string): boolean {
  if (!url || isInternalUrl(url)) return false;
  return /^https?:\/\//i.test(url);
}

export interface RecordVisitInput {
  profileId: string;
  url: string;
  title: string;
  transition: VisitTransition;
  workspaceId: string | null;
}

/**
 * Browsing history. Records visits (skipping internal and non-web URLs),
 * powers omnibox prefix matching, and provides search/timeline queries.
 */
export class HistoryService {
  constructor(private readonly repos: Repositories) {}

  record(input: RecordVisitInput): HistoryEntry | null {
    if (!isRecordable(input.url)) return null;
    return this.repos.history.recordVisit(input);
  }

  /**
   * Correct an entry's title once the page reports one. A visit is recorded the
   * moment it commits, before the document has parsed its `<title>`, so the
   * title arrives after the entry does.
   */
  setTitle(profileId: string, url: string, title: string): void {
    if (title && isRecordable(url)) this.repos.history.setTitle(profileId, url, title);
  }

  setFavicon(profileId: string, url: string, favicon: string): void {
    if (isRecordable(url)) this.repos.history.setFavicon(profileId, url, favicon);
  }

  search(params: {
    profileId: string;
    query: string;
    limit: number;
    offset: number;
    from?: number;
    to?: number;
  }): HistoryEntry[] {
    return this.repos.history.search(params);
  }

  prefixMatch(profileId: string, prefix: string, limit: number): HistoryEntry[] {
    return this.repos.history.prefixMatch(profileId, prefix, limit);
  }

  topSites(profileId: string, limit: number): HistoryEntry[] {
    return this.repos.history.topSites(profileId, limit);
  }

  deleteEntries(entryIds: string[]): void {
    this.repos.history.deleteEntries(entryIds);
  }

  deleteByUrl(profileId: string, url: string): void {
    this.repos.history.deleteByUrl(profileId, url);
  }

  deleteRange(profileId: string, from: number, to: number): void {
    this.repos.history.deleteRange(profileId, from, to);
  }

  clear(profileId: string): void {
    this.repos.history.clear(profileId);
  }

  /** Enforce the configured retention window; called periodically. */
  prune(profileId: string): void {
    if (LIMITS.historyRetentionDays > 0) {
      const cutoff = Date.now() - LIMITS.historyRetentionDays * 86_400_000;
      this.repos.history.pruneOlderThan(profileId, cutoff);
    }
  }
}
