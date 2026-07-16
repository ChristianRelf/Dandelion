import Database from 'better-sqlite3';
import { MIGRATIONS } from './migrations';

export type SqliteDatabase = Database.Database;
export type SqliteStatement = Database.Statement;

interface MigrationRow {
  version: number;
}

/**
 * Owns the SQLite connection lifecycle: pragmas, forward-only migrations,
 * transactions and backups. Repositories receive {@link raw} and never open
 * their own connection.
 */
export class Db {
  readonly raw: SqliteDatabase;

  constructor(filename: string) {
    this.raw = new Database(filename);
    this.raw.pragma('journal_mode = WAL');
    this.raw.pragma('foreign_keys = ON');
    this.raw.pragma('synchronous = NORMAL');
    this.raw.pragma('busy_timeout = 5000');
    this.migrate();
  }

  private migrate(): void {
    this.raw.exec(
      `CREATE TABLE IF NOT EXISTS _migrations (
         version INTEGER PRIMARY KEY,
         name TEXT NOT NULL,
         applied_at INTEGER NOT NULL
       )`,
    );

    const applied = new Set(
      (this.raw.prepare('SELECT version FROM _migrations').all() as MigrationRow[]).map(
        (row) => row.version,
      ),
    );

    const pending = MIGRATIONS.filter((migration) => !applied.has(migration.version)).sort(
      (a, b) => a.version - b.version,
    );
    if (pending.length === 0) return;

    const record = this.raw.prepare(
      'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
    );
    const runAll = this.raw.transaction(() => {
      for (const migration of pending) {
        migration.up(this.raw);
        record.run(migration.version, migration.name, Date.now());
      }
    });
    runAll();
  }

  /** Run `fn` inside a single transaction, rolling back on any thrown error. */
  transaction<T>(fn: () => T): T {
    return this.raw.transaction(fn)();
  }

  /** Write a consistent copy of the database to `destination`. */
  async backup(destination: string): Promise<void> {
    await this.raw.backup(destination);
  }

  close(): void {
    this.raw.close();
  }
}
