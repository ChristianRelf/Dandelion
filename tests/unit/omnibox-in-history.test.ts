import { describe, expect, it } from 'vitest';
import { OmniboxService, type OmniboxDeps } from '@main/services/omnibox.service';
import type { BookmarksService } from '@main/services/bookmarks.service';
import type { HistoryService } from '@main/services/history.service';
import type { SearchService } from '@main/services/search.service';
import type { SettingsService } from '@main/services/settings.service';

const PROFILE = 'profile-1';
const URL = 'https://example.com/article';

interface Options {
  history?: string[];
  bookmarks?: string[];
}

function makeService({ history = [], bookmarks = [] }: Options): OmniboxService {
  const deps: OmniboxDeps = {
    history: {
      topSites: () => [],
      prefixMatch: () =>
        history.map((url, index) => ({ id: `h${index}`, url, title: `History ${index}` })),
    } as unknown as HistoryService,
    bookmarks: {
      list: () =>
        bookmarks.map((url, index) => ({ id: `b${index}`, url, title: `Bookmark ${index}` })),
    } as unknown as BookmarksService,
    search: {
      getDefault: () => ({ name: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q={q}' }),
    } as unknown as SearchService,
    settings: {
      get: () => ({
        search: {
          showHistorySuggestions: true,
          showBookmarkSuggestions: true,
          searchSuggestions: false,
          enableCalculator: false,
          enableUnitConversion: false,
          enableTimezoneConversion: false,
        },
      }),
    } as unknown as SettingsService,
    tabs: { listAll: () => [] },
    clipboard: { readText: () => '' },
  };
  return new OmniboxService(deps);
}

const query = (options: Options) => makeService(options).query('example', PROFILE, 9);

describe('omnibox inHistory', () => {
  it('marks a history result', async () => {
    const results = await query({ history: [URL] });
    const hit = results.find((result) => result.url === URL);

    expect(hit?.kind).toBe('history');
    expect(hit?.inHistory).toBe(true);
  });

  /**
   * The reason this flag exists. Bookmarks outscore history (0.76 vs 0.72), so
   * dedupe by URL keeps the bookmark and throws the history result away — and a
   * `kind === 'history'` test would hide the removal action on exactly the
   * pages visited often enough to have been bookmarked.
   */
  it('marks a bookmark whose history twin was deduped away', async () => {
    const results = await query({ history: [URL], bookmarks: [URL] });
    const forUrl = results.filter((result) => result.url === URL);

    expect(forUrl).toHaveLength(1);
    expect(forUrl[0]?.kind).toBe('bookmark');
    expect(forUrl[0]?.inHistory).toBe(true);
  });

  it('leaves a bookmark that has never been visited unmarked', async () => {
    const results = await query({ bookmarks: [URL] });
    const hit = results.find((result) => result.url === URL);

    expect(hit?.kind).toBe('bookmark');
    expect(hit?.inHistory).toBe(false);
  });

  it('does not mark results that merely look like a visited page', async () => {
    const results = await query({ history: [URL] });
    const search = results.find((result) => result.kind === 'search');

    // A search for "example" is not the page at example.com/article.
    expect(search?.inHistory).toBe(false);
  });

  it('marks nothing when history has no match', async () => {
    const results = await query({ bookmarks: [URL] });
    expect(results.some((result) => result.inHistory)).toBe(false);
  });
});
