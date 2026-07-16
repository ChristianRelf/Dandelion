import type { SqliteDatabase } from '../database';

/** SQLite stores booleans as 0/1 — convert on the way out. */
export const toBool = (value: unknown): boolean => value === 1 || value === true;

/** …and on the way in. */
export const fromBool = (value: boolean): number => (value ? 1 : 0);

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Apply a partial column update, skipping `undefined` values so callers can
 * pass sparse patches. Column names are trusted (never user input).
 */
export function updateColumns(
  db: SqliteDatabase,
  table: string,
  id: string,
  columns: Record<string, unknown>,
): void {
  const entries = Object.entries(columns).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([key]) => `${key} = @${key}`).join(', ');
  const params: Record<string, unknown> = { id };
  for (const [key, value] of entries) params[key] = value;
  db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = @id`).run(params);
}
