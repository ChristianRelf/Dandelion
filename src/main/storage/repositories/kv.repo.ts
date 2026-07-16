import type { SqliteDatabase } from '../database';

interface KvRow {
  value: string;
}

/** A small typed key/value store for miscellaneous app state (window bounds, etc.). */
export class KvRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as KvRow | undefined;
    if (!row) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    this.db
      .prepare(
        `INSERT INTO kv (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.db.prepare('DELETE FROM kv WHERE key = ?').run(key);
  }
}
