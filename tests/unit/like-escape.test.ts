import { describe, expect, it } from 'vitest';
import { LIKE_ESCAPE, likeContains, likePrefix } from '@main/storage/repositories/helpers';

/**
 * Pins the patterns rather than the query results: better-sqlite3 is built
 * against Electron's ABI and cannot be loaded by vitest, so no unit test in
 * this repo can open a real database (see TODO.md § Testing). The patterns are
 * the whole of the fix, and they were verified against SQLite by hand —
 * searching `50%` matched every row containing "50" before, and `_` matched
 * every non-empty row.
 *
 * Every pattern here is only correct alongside `ESCAPE '\'` in the SQL. The
 * repositories build that clause from `LIKE_ESCAPE`, so the two cannot drift.
 */
describe('LIKE pattern escaping', () => {
  it('uses a backslash, matching the ESCAPE clause the repositories emit', () => {
    expect(LIKE_ESCAPE).toBe('\\');
  });

  it('leaves ordinary search terms alone', () => {
    expect(likeContains('news')).toBe('%news%');
    expect(likePrefix('example.com')).toBe('example.com%');
  });

  // `%` is the wildcard that made `50%` match "5012 items".
  it('escapes percent, so a literal percent is a literal percent', () => {
    expect(likeContains('50%')).toBe('%50\\%%');
    expect(likePrefix('50%')).toBe('50\\%%');
  });

  // `_` matches any single character, so an unescaped `_` matched everything.
  it('escapes underscore', () => {
    expect(likeContains('_')).toBe('%\\_%');
    expect(likeContains('a_b')).toBe('%a\\_b%');
  });

  // Without this the escape character would itself be an injection point into
  // the pattern: `\%` typed by a user would escape the `%` we appended.
  it('escapes the escape character itself', () => {
    expect(likeContains('back\\slash')).toBe('%back\\\\slash%');
    expect(likeContains('\\%')).toBe('%\\\\\\%%');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(likeContains('%_%')).toBe('%\\%\\_\\%%');
  });

  it('handles an empty query, which the bookmarks list passes when unfiltered', () => {
    expect(likeContains('')).toBe('%%');
  });
});
