import type { HistoryEntry, VisitTransition } from '@shared/types';
import { createId } from '@shared/utils';
import type { SqliteDatabase } from '../database';

interface EntryRow {
  id: string;
  profile_id: string;
  url: string;
  title: string;
  favicon: string | null;
  visit_count: number;
  typed_count: number;
  last_visited_at: number;
}

const toEntry = (row: EntryRow): HistoryEntry => ({
  id: row.id,
  profileId: row.profile_id,
  url: row.url,
  title: row.title,
  favicon: row.favicon,
  visitCount: row.visit_count,
  typedCount: row.typed_count,
  lastVisitedAt: row.last_visited_at,
});

export interface RecordVisitParams {
  profileId: string;
  url: string;
  title: string;
  transition: VisitTransition;
  workspaceId: string | null;
}

export class HistoryRepository {
  constructor(private readonly db: SqliteDatabase) {}

  recordVisit(params: RecordVisitParams): HistoryEntry {
    const now = Date.now();
    const typedIncrement = params.transition === 'typed' ? 1 : 0;
    const existing = this.db
      .prepare('SELECT * FROM history_entries WHERE profile_id = ? AND url = ?')
      .get(params.profileId, params.url) as EntryRow | undefined;

    let entryId: string;
    if (existing) {
      entryId = existing.id;
      this.db
        .prepare(
          `UPDATE history_entries
             SET visit_count = visit_count + 1,
                 typed_count = typed_count + ?,
                 title = CASE WHEN ? <> '' THEN ? ELSE title END,
                 last_visited_at = ?
           WHERE id = ?`,
        )
        .run(typedIncrement, params.title, params.title, now, entryId);
    } else {
      entryId = createId('he');
      this.db
        .prepare(
          `INSERT INTO history_entries
             (id, profile_id, url, title, favicon, visit_count, typed_count, last_visited_at)
           VALUES (?, ?, ?, ?, NULL, 1, ?, ?)`,
        )
        .run(entryId, params.profileId, params.url, params.title, typedIncrement, now);
    }

    this.db
      .prepare(
        `INSERT INTO history_visits
           (id, entry_id, workspace_id, visited_at, transition, referrer_visit_id, duration_ms)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
      )
      .run(createId('hv'), entryId, params.workspaceId, now, params.transition);

    const row = this.db
      .prepare('SELECT * FROM history_entries WHERE id = ?')
      .get(entryId) as EntryRow;
    return toEntry(row);
  }

  setFavicon(profileId: string, url: string, favicon: string): void {
    this.db
      .prepare('UPDATE history_entries SET favicon = ? WHERE profile_id = ? AND url = ?')
      .run(favicon, profileId, url);
  }

  search(params: {
    profileId: string;
    query: string;
    limit: number;
    offset: number;
    from?: number;
    to?: number;
  }): HistoryEntry[] {
    const clauses = ['profile_id = @profileId'];
    if (params.query) clauses.push('(url LIKE @like OR title LIKE @like)');
    if (params.from !== undefined) clauses.push('last_visited_at >= @from');
    if (params.to !== undefined) clauses.push('last_visited_at <= @to');

    const rows = this.db
      .prepare(
        `SELECT * FROM history_entries
         WHERE ${clauses.join(' AND ')}
         ORDER BY last_visited_at DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all({
        profileId: params.profileId,
        like: `%${params.query}%`,
        from: params.from ?? 0,
        to: params.to ?? 0,
        limit: params.limit,
        offset: params.offset,
      }) as EntryRow[];
    return rows.map(toEntry);
  }

  /** Prefix match for omnibox inline autocomplete, ranked by frequency + recency. */
  prefixMatch(profileId: string, prefix: string, limit: number): HistoryEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM history_entries
         WHERE profile_id = @profileId AND (url LIKE @prefix OR title LIKE @prefix)
         ORDER BY (visit_count * 2 + typed_count * 5) DESC, last_visited_at DESC
         LIMIT @limit`,
      )
      .all({ profileId, prefix: `${prefix}%`, limit }) as EntryRow[];
    return rows.map(toEntry);
  }

  topSites(profileId: string, limit: number): HistoryEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM history_entries WHERE profile_id = ?
         ORDER BY visit_count DESC, last_visited_at DESC LIMIT ?`,
      )
      .all(profileId, limit) as EntryRow[];
    return rows.map(toEntry);
  }

  deleteEntries(entryIds: string[]): void {
    if (entryIds.length === 0) return;
    const stmt = this.db.prepare('DELETE FROM history_entries WHERE id = ?');
    const run = this.db.transaction((ids: string[]) => ids.forEach((id) => stmt.run(id)));
    run(entryIds);
  }

  deleteByUrl(profileId: string, url: string): void {
    this.db
      .prepare('DELETE FROM history_entries WHERE profile_id = ? AND url = ?')
      .run(profileId, url);
  }

  deleteRange(profileId: string, from: number, to: number): void {
    this.db
      .prepare(
        'DELETE FROM history_entries WHERE profile_id = ? AND last_visited_at >= ? AND last_visited_at <= ?',
      )
      .run(profileId, from, to);
  }

  clear(profileId: string): void {
    this.db.prepare('DELETE FROM history_entries WHERE profile_id = ?').run(profileId);
  }

  pruneOlderThan(profileId: string, cutoff: number): void {
    this.db
      .prepare('DELETE FROM history_entries WHERE profile_id = ? AND last_visited_at < ?')
      .run(profileId, cutoff);
  }
}
