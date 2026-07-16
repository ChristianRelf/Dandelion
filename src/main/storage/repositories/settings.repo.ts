import type { Settings } from '@shared/types';
import type { SqliteDatabase } from '../database';

interface SettingsRow {
  scope: string;
  data: string;
  version: number;
  updated_at: number;
}

export class SettingsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get(scope: string): Settings | null {
    const row = this.db.prepare('SELECT * FROM settings WHERE scope = ?').get(scope) as
      SettingsRow | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.data) as Settings;
    } catch {
      return null;
    }
  }

  set(scope: string, settings: Settings): void {
    this.db
      .prepare(
        `INSERT INTO settings (scope, data, version, updated_at)
         VALUES (@scope, @data, @version, @updated_at)
         ON CONFLICT(scope) DO UPDATE SET
           data = excluded.data,
           version = excluded.version,
           updated_at = excluded.updated_at`,
      )
      .run({
        scope,
        data: JSON.stringify(settings),
        version: settings.version,
        updated_at: Date.now(),
      });
  }
}
