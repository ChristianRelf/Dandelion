import type BetterSqlite3 from 'better-sqlite3';

/**
 * The reading list: pages saved to read later, with a read/unread state. Owned
 * per profile and torn down with it, like every other user-content table.
 * `UNIQUE(profile_id, url)` makes "save this page" naturally idempotent.
 */
export function up(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE reading_list (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      title       TEXT NOT NULL DEFAULT '',
      favicon     TEXT,
      is_read     INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL,
      read_at     INTEGER,
      UNIQUE(profile_id, url)
    );
    CREATE INDEX idx_reading_list_profile ON reading_list(profile_id, is_read, created_at DESC);
  `);
}
