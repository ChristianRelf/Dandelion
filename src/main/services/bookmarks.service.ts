import type { Bookmark, BookmarkFolder, Result } from '@shared/types';
import { appError, err, ok } from '@shared/types';
import { createId } from '@shared/utils';
import type { Repositories } from '../storage';
import type { EventBus } from '../core/event-bus';

export interface AddBookmarkInput {
  profileId: string;
  url: string;
  title: string;
  folderId: string | null;
  workspaceId: string | null;
  tags: string[];
  description: string | null;
}

/**
 * The inverse of `exportHtml`'s escaping. A Netscape bookmark file carries
 * hrefs HTML-escaped — Dandelion's own export does it, and so do Chrome's and
 * Firefox's — so `?a=1&amp;b=2` must come back as `?a=1&b=2`. Reading the
 * capture group raw stored the escaped text as the URL.
 *
 * `&amp;` is decoded last: doing it first would turn `&amp;lt;` into `&lt;` and
 * then into `<`, inventing markup the file never contained.
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Bookmarks, folders, and Netscape-format import/export. */
export class BookmarksService {
  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
  ) {}

  /**
   * Announce that a URL's bookmarked state moved. The toolbar star has no other
   * way to know: `⌘D` and the palette reach the DB without passing through it,
   * so before this it guessed optimistically and drifted out of sync with the
   * truth.
   */
  private announce(profileId: string, url: string, bookmarked: boolean): void {
    this.events.emit({ type: 'bookmark:changed', profileId, url, bookmarked });
  }

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
    this.announce(bookmark.profileId, bookmark.url, true);
    return bookmark;
  }

  update(
    id: string,
    patch: Partial<Pick<Bookmark, 'title' | 'url' | 'folderId' | 'tags' | 'description'>>,
  ): Result<Bookmark> {
    const before = this.repos.bookmarks.get(id);
    if (!before) {
      return err(appError('bookmark/not-found', 'Bookmark not found'));
    }
    this.repos.bookmarks.update(id, patch);
    const after = this.repos.bookmarks.get(id)!;
    // Editing the URL bookmarks a new page and unbookmarks the old one, so both
    // stars have to hear about it.
    if (after.url !== before.url) this.announce(before.profileId, before.url, false);
    this.announce(after.profileId, after.url, true);
    return ok(after);
  }

  remove(id: string): void {
    const bookmark = this.repos.bookmarks.get(id);
    this.repos.bookmarks.remove(id);
    if (bookmark) this.announce(bookmark.profileId, bookmark.url, false);
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
      // Through `remove`, not the repo, so this path announces like every other.
      this.remove(existing.id);
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
      const url = decodeEntities(match[1]!);
      const title = decodeEntities(match[2]!.replace(/<[^>]+>/g, '')).trim();
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
