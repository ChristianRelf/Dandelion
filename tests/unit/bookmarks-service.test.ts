import { describe, expect, it } from 'vitest';
import { BookmarksService, parseChromiumBookmarks } from '@main/services/bookmarks.service';
import type { Bookmark, BrowserEvent } from '@shared/types';
import type { Repositories } from '@main/storage';
import type { EventBus } from '@main/core/event-bus';

const PROFILE = 'profile_1';

/** An in-memory bookmarks repo — enough for add/remove/toggle/import/export. */
function makeService() {
  const rows = new Map<string, Bookmark>();
  const emitted: BrowserEvent[] = [];

  const repos = {
    bookmarks: {
      list: () => [...rows.values()],
      get: (id: string) => rows.get(id) ?? null,
      insert: (bookmark: Bookmark) => rows.set(bookmark.id, bookmark),
      remove: (id: string) => rows.delete(id),
      update: (id: string, patch: Partial<Bookmark>) => {
        const existing = rows.get(id);
        if (existing) rows.set(id, { ...existing, ...patch });
      },
      findByUrl: (_profileId: string, url: string) =>
        [...rows.values()].find((bookmark) => bookmark.url === url) ?? null,
      nextOrder: () => rows.size,
    },
  } as unknown as Repositories;

  const service = new BookmarksService(repos, {
    emit: (event: BrowserEvent) => emitted.push(event),
  } as unknown as EventBus);

  return { service, emitted, rows };
}

function changes(emitted: BrowserEvent[]) {
  return emitted.filter((event) => event.type === 'bookmark:changed');
}

describe('BookmarksService — Netscape import/export round trip', () => {
  // The defect: `exportHtml` escapes the href (`&` → `&amp;`) but `importHtml`
  // read the capture group raw, so Dandelion's own export could not survive its
  // own import. Chrome and Firefox escape hrefs the same way, so their files
  // were corrupted on the way in too — silently, until a link was clicked.
  it('survives its own export for a URL with two query parameters', () => {
    const { service } = makeService();
    const url = 'https://example.com/search?a=1&b=2';
    service.add({
      profileId: PROFILE,
      url,
      title: 'Tips & Tricks',
      folderId: null,
      workspaceId: null,
      tags: [],
      description: null,
    });

    const html = service.exportHtml(PROFILE);
    expect(html).toContain('&amp;'); // the export really does escape

    const fresh = makeService();
    expect(fresh.service.importHtml(PROFILE, html)).toBe(1);
    const [imported] = fresh.service.list(PROFILE);
    expect(imported?.url).toBe(url);
    expect(imported?.title).toBe('Tips & Tricks');
  });

  it('decodes the entities a real browser export uses', () => {
    const { service } = makeService();
    const html =
      '<DT><A HREF="https://example.com/?x=1&amp;y=2&amp;z=3">A &lt;b&gt; &quot;quoted&quot; &amp; bold</A>';
    expect(service.importHtml(PROFILE, html)).toBe(1);
    const [imported] = service.list(PROFILE);
    expect(imported?.url).toBe('https://example.com/?x=1&y=2&z=3');
    expect(imported?.title).toBe('A <b> "quoted" & bold');
  });

  // Decoding `&amp;` first would turn `&amp;lt;` into `&lt;` and then into `<`,
  // inventing markup the file never contained.
  it('does not double-decode an escaped entity', () => {
    const { service } = makeService();
    expect(service.importHtml(PROFILE, '<DT><A HREF="https://example.com/?q=1">&amp;lt;</A>')).toBe(
      1,
    );
    expect(service.list(PROFILE)[0]?.title).toBe('&lt;');
  });

  it('still rejects a non-http scheme', () => {
    const { service } = makeService();
    expect(service.importHtml(PROFILE, '<DT><A HREF="javascript:alert(1)">x</A>')).toBe(0);
  });
});

// A trimmed but faithful Chromium `Bookmarks` file: nested folders under
// `bookmark_bar`, a second root, a non-web scheme to reject, and a duplicate.
const CHROMIUM_BOOKMARKS = JSON.stringify({
  checksum: 'abc',
  version: 1,
  roots: {
    bookmark_bar: {
      type: 'folder',
      name: 'Bookmarks bar',
      children: [
        { type: 'url', name: 'Example', url: 'https://example.com/' },
        {
          type: 'folder',
          name: 'Dev',
          children: [
            { type: 'url', name: 'GitHub', url: 'https://github.com/' },
            { type: 'url', name: 'Extensions', url: 'chrome://extensions' },
          ],
        },
      ],
    },
    other: {
      type: 'folder',
      name: 'Other bookmarks',
      children: [{ type: 'url', name: 'Example again', url: 'https://example.com/' }],
    },
    synced: { type: 'folder', name: 'Mobile', children: [] },
  },
});

describe('parseChromiumBookmarks', () => {
  it('flattens every URL out of the folder tree, across all roots', () => {
    const items = parseChromiumBookmarks(CHROMIUM_BOOKMARKS);
    expect(items.map((item) => item.url)).toEqual([
      'https://example.com/',
      'https://github.com/',
      'chrome://extensions',
      'https://example.com/',
    ]);
    expect(items[1]).toEqual({ url: 'https://github.com/', title: 'GitHub' });
  });

  it('returns [] for a Netscape HTML file, so the caller can fall back', () => {
    expect(parseChromiumBookmarks('<DT><A HREF="https://example.com/">x</A>')).toEqual([]);
  });

  it('returns [] for invalid JSON or a document without roots', () => {
    expect(parseChromiumBookmarks('not json {')).toEqual([]);
    expect(parseChromiumBookmarks('{"version":1}')).toEqual([]);
    expect(parseChromiumBookmarks('null')).toEqual([]);
  });
});

describe('BookmarksService.importFile detects the format', () => {
  it('imports a Chromium file, skipping the non-web scheme and the duplicate URL', () => {
    const { service } = makeService();
    const result = service.importFile(PROFILE, CHROMIUM_BOOKMARKS);
    // github + one example.com (second example.com deduped, chrome:// rejected).
    expect(result).toEqual({ imported: 2, source: 'chromium' });
    expect(
      service
        .list(PROFILE)
        .map((bookmark) => bookmark.url)
        .sort(),
    ).toEqual(['https://example.com/', 'https://github.com/']);
  });

  it('falls back to the Netscape importer for an HTML export', () => {
    const { service } = makeService();
    const result = service.importFile(PROFILE, '<DT><A HREF="https://example.com/">Example</A>');
    expect(result).toEqual({ imported: 1, source: 'netscape' });
  });

  it('does not re-add a bookmark already saved', () => {
    const { service } = makeService();
    service.add({
      profileId: PROFILE,
      url: 'https://github.com/',
      title: 'GitHub',
      folderId: null,
      workspaceId: null,
      tags: [],
      description: null,
    });
    expect(service.importFile(PROFILE, CHROMIUM_BOOKMARKS).imported).toBe(1);
  });
});

describe('BookmarksService announces every change', () => {
  // The star had no other way to learn: ⌘D and the palette reach the DB without
  // passing through the Toolbar, so it guessed optimistically and inverted as
  // soon as the two inputs were mixed.
  it('announces a toggle on, then off, for the same URL', () => {
    const { service, emitted } = makeService();
    const url = 'https://example.com/';

    service.toggle(PROFILE, url, 'Example', null);
    expect(changes(emitted).at(-1)).toMatchObject({ url, bookmarked: true });

    service.toggle(PROFILE, url, 'Example', null);
    expect(changes(emitted).at(-1)).toMatchObject({ url, bookmarked: false });
  });

  it('announces a direct remove', () => {
    const { service, emitted } = makeService();
    const bookmark = service.add({
      profileId: PROFILE,
      url: 'https://example.com/',
      title: 'Example',
      folderId: null,
      workspaceId: null,
      tags: [],
      description: null,
    });

    service.remove(bookmark.id);
    expect(changes(emitted).at(-1)).toMatchObject({
      url: 'https://example.com/',
      bookmarked: false,
    });
  });

  // Editing the URL bookmarks a new page and unbookmarks the old one; a star on
  // either page has to hear about it.
  it('announces both URLs when an edit moves one', () => {
    const { service, emitted } = makeService();
    const bookmark = service.add({
      profileId: PROFILE,
      url: 'https://old.example.com/',
      title: 'Old',
      folderId: null,
      workspaceId: null,
      tags: [],
      description: null,
    });

    service.update(bookmark.id, { url: 'https://new.example.com/' });

    expect(changes(emitted).slice(-2)).toMatchObject([
      { url: 'https://old.example.com/', bookmarked: false },
      { url: 'https://new.example.com/', bookmarked: true },
    ]);
  });
});
