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
 * The escape character for the `LIKE` patterns below. Backslash by convention —
 * it is escaped like any other special character, so the choice costs nothing.
 *
 * Build the SQL's `ESCAPE` clause from this constant rather than typing it, so
 * the clause and the escaping cannot drift apart.
 */
export const LIKE_ESCAPE = '\\';

/**
 * Neutralise `LIKE`'s wildcards in user input.
 *
 * `%` and `_` are wildcards to SQLite even when the value arrives as a bound
 * parameter — binding stops injection, not interpretation. Unescaped, a search
 * for `50%` matches every row containing "50", and a search for `_` matches
 * every non-empty row.
 */
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE}${character}`);

/**
 * A `LIKE` pattern matching rows that contain `value` anywhere.
 *
 * The query **must** carry `` ESCAPE '${LIKE_ESCAPE}' `` or the escaping here is
 * inert and the wildcards are live again.
 */
export const likeContains = (value: string): string => `%${escapeLike(value)}%`;

/** A `LIKE` pattern matching rows that start with `value`. Needs `ESCAPE` too. */
export const likePrefix = (value: string): string => `${escapeLike(value)}%`;

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
