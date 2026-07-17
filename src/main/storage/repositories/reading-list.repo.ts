import type { ReadingItem } from '@shared/types';
import type { SqliteDatabase } from '../database';

interface ReadingItemRow {
  id: string;
  profile_id: string;
  url: string;
  title: string;
  favicon: string | null;
  is_read: number;
  created_at: number;
  read_at: number | null;
}

const toItem = (row: ReadingItemRow): ReadingItem => ({
  id: row.id,
  profileId: row.profile_id,
  url: row.url,
  title: row.title,
  favicon: row.favicon,
  read: row.is_read === 1,
  createdAt: row.created_at,
  readAt: row.read_at,
});

export class ReadingListRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Unread first, newest first within each group — the order the panel shows. */
  list(profileId: string): ReadingItem[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM reading_list WHERE profile_id = ? ORDER BY is_read ASC, created_at DESC',
      )
      .all(profileId) as ReadingItemRow[];
    return rows.map(toItem);
  }

  findByUrl(profileId: string, url: string): ReadingItem | null {
    const row = this.db
      .prepare('SELECT * FROM reading_list WHERE profile_id = ? AND url = ? LIMIT 1')
      .get(profileId, url) as ReadingItemRow | undefined;
    return row ? toItem(row) : null;
  }

  insert(item: ReadingItem): void {
    this.db
      .prepare(
        `INSERT INTO reading_list (id, profile_id, url, title, favicon, is_read, created_at, read_at)
         VALUES (@id, @profile_id, @url, @title, @favicon, @is_read, @created_at, @read_at)`,
      )
      .run({
        id: item.id,
        profile_id: item.profileId,
        url: item.url,
        title: item.title,
        favicon: item.favicon,
        is_read: item.read ? 1 : 0,
        created_at: item.createdAt,
        read_at: item.readAt,
      });
  }

  setRead(id: string, read: boolean): void {
    this.db
      .prepare('UPDATE reading_list SET is_read = ?, read_at = ? WHERE id = ?')
      .run(read ? 1 : 0, read ? Date.now() : null, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM reading_list WHERE id = ?').run(id);
  }

  /** Drop every already-read item — the "Clear read" broom. */
  clearRead(profileId: string): void {
    this.db.prepare('DELETE FROM reading_list WHERE profile_id = ? AND is_read = 1').run(profileId);
  }
}
