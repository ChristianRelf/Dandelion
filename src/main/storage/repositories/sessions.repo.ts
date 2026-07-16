import type { SessionSnapshot } from '@shared/types';
import type { SqliteDatabase } from '../database';

interface SessionRow {
  id: string;
  reason: string;
  created_at: number;
  data: string;
}

export class SessionsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  save(snapshot: SessionSnapshot): void {
    this.db
      .prepare('INSERT INTO sessions (id, reason, created_at, data) VALUES (?, ?, ?, ?)')
      .run(snapshot.id, snapshot.reason, snapshot.createdAt, JSON.stringify(snapshot.windows));
  }

  latest(): SessionSnapshot | null {
    const row = this.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1').get() as
      SessionRow | undefined;
    if (!row) return null;
    return this.rowToSnapshot(row);
  }

  get(id: string): SessionSnapshot | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined;
    return row ? this.rowToSnapshot(row) : null;
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  list(limit: number): SessionSnapshot[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?')
      .all(limit) as SessionRow[];
    return rows.map((row) => this.rowToSnapshot(row));
  }

  /** Keep only the `keep` most recent snapshots. */
  prune(keep: number): void {
    this.db
      .prepare(
        `DELETE FROM sessions WHERE id NOT IN (
           SELECT id FROM sessions ORDER BY created_at DESC LIMIT ?
         )`,
      )
      .run(keep);
  }

  private rowToSnapshot(row: SessionRow): SessionSnapshot {
    return {
      id: row.id,
      reason: row.reason as SessionSnapshot['reason'],
      createdAt: row.created_at,
      windows: JSON.parse(row.data) as SessionSnapshot['windows'],
    };
  }
}
