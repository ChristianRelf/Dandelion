import { describe, expect, it } from 'vitest';
import { OmniboxService, type OmniboxDeps } from '@main/services/omnibox.service';
import { prettifyUrl } from '@shared/utils';
import type { BookmarksService } from '@main/services/bookmarks.service';
import type { HistoryService } from '@main/services/history.service';
import type { SearchService } from '@main/services/search.service';
import type { SettingsService } from '@main/services/settings.service';

const PROFILE = 'profile-1';

function makeService(history: string[]): OmniboxService {
  const deps: OmniboxDeps = {
    history: {
      topSites: () => [],
      prefixMatch: () =>
        history.map((url, index) => ({ id: `h${index}`, url, title: `History ${index}` })),
    } as unknown as HistoryService,
    bookmarks: { list: () => [] } as unknown as BookmarksService,
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

describe('omnibox inline autocomplete', () => {
  // The defect: `finalize` chose the completion from any ranked result but wrote
  // it onto ranked[0], so typing a plain word that prefixes a visited site put
  // that site's completion on the top *search* result. Enter activates ranked[0]
  // — the search — so the ghost text advertised a destination Enter would not go
  // to.
  it('does not stamp a visited site’s completion onto a top search result', async () => {
    const results = await makeService(['https://github.com/']).query('github', PROFILE, 9);

    expect(results[0]?.kind).toBe('search');
    expect(results[0]?.inlineCompletion).toBeFalsy();
    // No lower-ranked result carries a completion either.
    expect(results.slice(1).every((result) => !result.inlineCompletion)).toBe(true);
  });

  // The invariant the fix guarantees, across inputs: a completion only ever sits
  // on the top result, and always completes to that result's own URL — so the
  // ghost text can never disagree with where Enter goes.
  it('only completes the top result, and only to its own destination', async () => {
    for (const input of ['github', 'github.co', 'example.com', 'duck']) {
      const results = await makeService(['https://github.com/', 'https://example.com/']).query(
        input,
        PROFILE,
        9,
      );
      results.forEach((result, index) => {
        if (!result.inlineCompletion) return;
        expect(index).toBe(0);
        expect(prettifyUrl(result.url ?? '').toLowerCase()).toBe(
          (input + result.inlineCompletion).toLowerCase(),
        );
      });
    }
  });
});
