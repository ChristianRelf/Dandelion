import type { Bookmark, BookmarkFolder } from '@shared/types';
import type { SqliteDatabase } from '../database';
import { LIKE_ESCAPE, likeContains, parseJson, updateColumns } from './helpers';

interface BookmarkRow {
  id: string;
  profile_id: string;
  folder_id: string | null;
  workspace_id: string | null;
  url: string;
  title: string;
  favicon: string | null;
  description: string | null;
  tags: string;
  order_index: number;
  created_at: number;
  updated_at: number;
}

interface FolderRow {
  id: string;
  profile_id: string;
  parent_id: string | null;
  name: string;
  order_index: number;
  created_at: number;
}

const toBookmark = (row: BookmarkRow): Bookmark => ({
  id: row.id,
  profileId: row.profile_id,
  folderId: row.folder_id,
  workspaceId: row.workspace_id,
  url: row.url,
  title: row.title,
  favicon: row.favicon,
  description: row.description,
  tags: parseJson<string[]>(row.tags, []),
  index: row.order_index,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toFolder = (row: FolderRow): BookmarkFolder => ({
  id: row.id,
  profileId: row.profile_id,
  parentId: row.parent_id,
  name: row.name,
  index: row.order_index,
  createdAt: row.created_at,
});

export class BookmarksRepository {
  constructor(private readonly db: SqliteDatabase) {}

  list(profileId: string, folderId?: string | null, query?: string): Bookmark[] {
    const clauses = ['profile_id = @profileId'];
    if (folderId !== undefined)
      clauses.push(folderId === null ? 'folder_id IS NULL' : 'folder_id = @folderId');
    if (query)
      clauses.push(
        `(url LIKE @like ESCAPE '${LIKE_ESCAPE}'` +
          ` OR title LIKE @like ESCAPE '${LIKE_ESCAPE}'` +
          ` OR tags LIKE @like ESCAPE '${LIKE_ESCAPE}')`,
      );
    const rows = this.db
      .prepare(
        `SELECT * FROM bookmarks WHERE ${clauses.join(' AND ')} ORDER BY order_index ASC, created_at DESC`,
      )
      .all({
        profileId,
        folderId: folderId ?? null,
        like: likeContains(query ?? ''),
      }) as BookmarkRow[];
    return rows.map(toBookmark);
  }

  get(id: string): Bookmark | null {
    const row = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id) as
      BookmarkRow | undefined;
    return row ? toBookmark(row) : null;
  }

  findByUrl(profileId: string, url: string): Bookmark | null {
    const row = this.db
      .prepare('SELECT * FROM bookmarks WHERE profile_id = ? AND url = ? LIMIT 1')
      .get(profileId, url) as BookmarkRow | undefined;
    return row ? toBookmark(row) : null;
  }

  insert(bookmark: Bookmark): void {
    this.db
      .prepare(
        `INSERT INTO bookmarks
           (id, profile_id, folder_id, workspace_id, url, title, favicon, description, tags, order_index, created_at, updated_at)
         VALUES (@id, @profile_id, @folder_id, @workspace_id, @url, @title, @favicon, @description, @tags, @order_index, @created_at, @updated_at)`,
      )
      .run({
        id: bookmark.id,
        profile_id: bookmark.profileId,
        folder_id: bookmark.folderId,
        workspace_id: bookmark.workspaceId,
        url: bookmark.url,
        title: bookmark.title,
        favicon: bookmark.favicon,
        description: bookmark.description,
        tags: JSON.stringify(bookmark.tags),
        order_index: bookmark.index,
        created_at: bookmark.createdAt,
        updated_at: bookmark.updatedAt,
      });
  }

  update(
    id: string,
    patch: Partial<Pick<Bookmark, 'title' | 'url' | 'folderId' | 'tags' | 'description'>>,
  ): void {
    updateColumns(this.db, 'bookmarks', id, {
      title: patch.title,
      url: patch.url,
      folder_id: patch.folderId,
      tags: patch.tags === undefined ? undefined : JSON.stringify(patch.tags),
      description: patch.description,
      updated_at: Date.now(),
    });
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  }

  nextOrder(profileId: string, folderId: string | null): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(MAX(order_index), -1) AS max FROM bookmarks
         WHERE profile_id = ? AND ${folderId === null ? 'folder_id IS NULL' : 'folder_id = ?'}`,
      )
      .get(...(folderId === null ? [profileId] : [profileId, folderId])) as { max: number };
    return row.max + 1;
  }

  /* ---- Folders ---- */

  listFolders(profileId: string): BookmarkFolder[] {
    const rows = this.db
      .prepare('SELECT * FROM bookmark_folders WHERE profile_id = ? ORDER BY order_index ASC')
      .all(profileId) as FolderRow[];
    return rows.map(toFolder);
  }

  insertFolder(folder: BookmarkFolder): void {
    this.db
      .prepare(
        `INSERT INTO bookmark_folders (id, profile_id, parent_id, name, order_index, created_at)
         VALUES (@id, @profile_id, @parent_id, @name, @order_index, @created_at)`,
      )
      .run({
        id: folder.id,
        profile_id: folder.profileId,
        parent_id: folder.parentId,
        name: folder.name,
        order_index: folder.index,
        created_at: folder.createdAt,
      });
  }

  renameFolder(id: string, name: string): void {
    this.db.prepare('UPDATE bookmark_folders SET name = ? WHERE id = ?').run(name, id);
  }

  removeFolder(id: string): void {
    this.db.prepare('DELETE FROM bookmark_folders WHERE id = ?').run(id);
  }
}
