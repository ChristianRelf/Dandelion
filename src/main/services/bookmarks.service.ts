import type { Bookmark, BookmarkFolder, Result } from '@shared/types';
import { appError, err, ok } from '@shared/types';
import { createId } from '@shared/utils';
import type { Repositories } from '../storage';

export interface AddBookmarkInput {
  profileId: string;
  url: string;
  title: string;
  folderId: string | null;
  workspaceId: string | null;
  tags: string[];
  description: string | null;
}

/** Bookmarks, folders, and Netscape-format import/export. */
export class BookmarksService {
  constructor(private readonly repos: Repositories) {}

  list(profileId: string, folderId?: string | null, query?: string): Bookmark[] {
    return this.repos.bookmarks.list(profileId, folderId, query);
  }

  get(id: string): Bookmark | null {
    return this.repos.bookmarks.get(id);
  }

  isBookmarked(profileId: string, url: string): boolean {
    return this.repos.bookmarks.findByUrl(profileId, url) !== null;
  }

  add(input: AddBookmarkInput): Bookmark {
    const now = Date.now();
    const bookmark: Bookmark = {
      id: createId('bm'),
      profileId: input.profileId,
      folderId: input.folderId,
      workspaceId: input.workspaceId,
      url: input.url,
      title: input.title,
      favicon: null,
      description: input.description,
      tags: input.tags,
      index: this.repos.bookmarks.nextOrder(input.profileId, input.folderId),
      createdAt: now,
      updatedAt: now,
    };
    this.repos.bookmarks.insert(bookmark);
    return bookmark;
  }

  update(
    id: string,
    patch: Partial<Pick<Bookmark, 'title' | 'url' | 'folderId' | 'tags' | 'description'>>,
  ): Result<Bookmark> {
    if (!this.repos.bookmarks.get(id)) {
      return err(appError('bookmark/not-found', 'Bookmark not found'));
    }
    this.repos.bookmarks.update(id, patch);
    return ok(this.repos.bookmarks.get(id)!);
  }

  remove(id: string): void {
    this.repos.bookmarks.remove(id);
  }

  /** Add if absent, remove if present — powers the Ctrl/Cmd+D star toggle. */
  toggle(
    profileId: string,
    url: string,
    title: string,
    workspaceId: string | null,
  ): { added: boolean; bookmark: Bookmark | null } {
    const existing = this.repos.bookmarks.findByUrl(profileId, url);
    if (existing) {
      this.repos.bookmarks.remove(existing.id);
      return { added: false, bookmark: null };
    }
    const bookmark = this.add({
      profileId,
      url,
      title,
      folderId: null,
      workspaceId,
      tags: [],
      description: null,
    });
    return { added: true, bookmark };
  }

  listFolders(profileId: string): BookmarkFolder[] {
    return this.repos.bookmarks.listFolders(profileId);
  }

  createFolder(profileId: string, name: string, parentId: string | null): BookmarkFolder {
    const folder: BookmarkFolder = {
      id: createId('bmf'),
      profileId,
      parentId,
      name,
      index: this.repos.bookmarks.listFolders(profileId).length,
      createdAt: Date.now(),
    };
    this.repos.bookmarks.insertFolder(folder);
    return folder;
  }

  renameFolder(id: string, name: string): void {
    this.repos.bookmarks.renameFolder(id, name);
  }

  removeFolder(id: string): void {
    this.repos.bookmarks.removeFolder(id);
  }

  /** Export all bookmarks as a Netscape Bookmark File. */
  exportHtml(profileId: string): string {
    const bookmarks = this.repos.bookmarks.list(profileId);
    const escape = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const items = bookmarks
      .map(
        (bookmark) =>
          `        <DT><A HREF="${escape(bookmark.url)}" ADD_DATE="${Math.floor(
            bookmark.createdAt / 1000,
          )}">${escape(bookmark.title || bookmark.url)}</A>`,
      )
      .join('\n');
    return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
${items}
</DL><p>
`;
  }

  /** Import bookmarks from a Netscape Bookmark File; returns the count added. */
  importHtml(profileId: string, html: string): number {
    const anchorRe = /<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = anchorRe.exec(html)) !== null) {
      const url = match[1]!;
      const title = match[2]!.replace(/<[^>]+>/g, '').trim();
      if (!/^https?:/i.test(url)) continue;
      if (this.repos.bookmarks.findByUrl(profileId, url)) continue;
      this.add({
        profileId,
        url,
        title: title || url,
        folderId: null,
        workspaceId: null,
        tags: [],
        description: null,
      });
      count += 1;
    }
    return count;
  }
}
