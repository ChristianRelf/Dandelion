import type BetterSqlite3 from 'better-sqlite3';

/**
 * Notes: free-text jottings kept in the sidebar. The first user-content table
 * that persists arbitrary text, so it is intentionally minimal — one `content`
 * blob per note, owned per profile and torn down with it.
 */
export function up(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE notes (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      content     TEXT NOT NULL DEFAULT '',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX idx_notes_profile ON notes(profile_id, updated_at DESC);
  `);
}
