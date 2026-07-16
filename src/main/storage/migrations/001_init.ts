import type BetterSqlite3 from 'better-sqlite3';

/**
 * Initial schema. Every table carries millisecond epoch timestamps as INTEGER
 * and booleans as INTEGER (0/1). Foreign keys cascade so deleting a profile
 * tears down all of its owned data.
 */
export function up(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE TABLE profiles (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      color         TEXT NOT NULL,
      avatar        TEXT,
      partition     TEXT NOT NULL UNIQUE,
      is_default    INTEGER NOT NULL DEFAULT 0,
      is_private    INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE workspaces (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      icon          TEXT NOT NULL,
      accent_color  TEXT NOT NULL,
      wallpaper     TEXT,
      order_index   INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_workspaces_profile ON workspaces(profile_id, order_index);

    CREATE TABLE tab_groups (
      id            TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name          TEXT NOT NULL DEFAULT '',
      color         TEXT NOT NULL DEFAULT 'grey',
      collapsed     INTEGER NOT NULL DEFAULT 0,
      order_index   INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_groups_workspace ON tab_groups(workspace_id, order_index);

    CREATE TABLE tabs (
      id            TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      group_id      TEXT REFERENCES tab_groups(id) ON DELETE SET NULL,
      order_index   INTEGER NOT NULL DEFAULT 0,
      url           TEXT NOT NULL DEFAULT '',
      title         TEXT NOT NULL DEFAULT '',
      favicon       TEXT,
      pinned        INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );
    CREATE INDEX idx_tabs_workspace ON tabs(workspace_id, order_index);

    CREATE TABLE history_entries (
      id             TEXT PRIMARY KEY,
      profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      url            TEXT NOT NULL,
      title          TEXT NOT NULL DEFAULT '',
      favicon        TEXT,
      visit_count    INTEGER NOT NULL DEFAULT 0,
      typed_count    INTEGER NOT NULL DEFAULT 0,
      last_visited_at INTEGER NOT NULL,
      UNIQUE(profile_id, url)
    );
    CREATE INDEX idx_history_recent ON history_entries(profile_id, last_visited_at DESC);
    CREATE INDEX idx_history_visits ON history_entries(profile_id, visit_count DESC);

    CREATE TABLE history_visits (
      id                TEXT PRIMARY KEY,
      entry_id          TEXT NOT NULL REFERENCES history_entries(id) ON DELETE CASCADE,
      workspace_id      TEXT,
      visited_at        INTEGER NOT NULL,
      transition        TEXT NOT NULL DEFAULT 'link',
      referrer_visit_id TEXT,
      duration_ms       INTEGER
    );
    CREATE INDEX idx_visits_entry ON history_visits(entry_id, visited_at DESC);

    CREATE TABLE bookmark_folders (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      parent_id     TEXT REFERENCES bookmark_folders(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      order_index   INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_folders_profile ON bookmark_folders(profile_id, parent_id);

    CREATE TABLE bookmarks (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      folder_id     TEXT REFERENCES bookmark_folders(id) ON DELETE SET NULL,
      workspace_id  TEXT,
      url           TEXT NOT NULL,
      title         TEXT NOT NULL DEFAULT '',
      favicon       TEXT,
      description   TEXT,
      tags          TEXT NOT NULL DEFAULT '[]',
      order_index   INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_bookmarks_profile ON bookmarks(profile_id, folder_id, order_index);

    CREATE TABLE downloads (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      url           TEXT NOT NULL,
      filename      TEXT NOT NULL,
      save_path     TEXT NOT NULL,
      mime_type     TEXT NOT NULL DEFAULT '',
      state         TEXT NOT NULL DEFAULT 'in_progress',
      received_bytes INTEGER NOT NULL DEFAULT 0,
      total_bytes   INTEGER NOT NULL DEFAULT 0,
      referrer      TEXT,
      safety        TEXT NOT NULL DEFAULT 'unknown',
      started_at    INTEGER NOT NULL,
      completed_at  INTEGER
    );
    CREATE INDEX idx_downloads_profile ON downloads(profile_id, started_at DESC);

    CREATE TABLE permissions (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      origin        TEXT NOT NULL,
      type          TEXT NOT NULL,
      decision      TEXT NOT NULL,
      updated_at    INTEGER NOT NULL,
      UNIQUE(profile_id, origin, type)
    );
    CREATE INDEX idx_permissions_profile ON permissions(profile_id, origin);

    CREATE TABLE passwords (
      id              TEXT PRIMARY KEY,
      profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      origin          TEXT NOT NULL,
      username        TEXT NOT NULL,
      password_cipher TEXT NOT NULL,
      note            TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      last_used_at    INTEGER
    );
    CREATE INDEX idx_passwords_profile ON passwords(profile_id, origin);

    CREATE TABLE vault_meta (
      profile_id    TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      salt          TEXT NOT NULL,
      verifier      TEXT NOT NULL,
      wrapped_key   TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE search_engines (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      keyword       TEXT NOT NULL,
      search_url    TEXT NOT NULL,
      suggest_url   TEXT,
      favicon       TEXT,
      is_default    INTEGER NOT NULL DEFAULT 0,
      is_builtin    INTEGER NOT NULL DEFAULT 0,
      order_index   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE settings (
      scope         TEXT PRIMARY KEY,
      data          TEXT NOT NULL,
      version       INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE sessions (
      id            TEXT PRIMARY KEY,
      reason        TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      data          TEXT NOT NULL
    );
    CREATE INDEX idx_sessions_recent ON sessions(created_at DESC);

    CREATE TABLE kv (
      key           TEXT PRIMARY KEY,
      value         TEXT NOT NULL
    );
  `);
}
