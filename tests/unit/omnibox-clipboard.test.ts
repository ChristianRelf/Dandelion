import { describe, expect, it } from 'vitest';
import { OmniboxService, type OmniboxDeps } from '@main/services/omnibox.service';
import type { BookmarksService } from '@main/services/bookmarks.service';
import type { HistoryService } from '@main/services/history.service';
import type { SearchService } from '@main/services/search.service';
import type { SettingsService } from '@main/services/settings.service';

const PROFILE = 'profile-1';

interface Options {
  clipboard: string;
  enabled?: boolean;
  /** Throw from readText, as a clipboard held by another app does. */
  throws?: boolean;
}

/**
 * The empty-state path only touches settings, top sites and the clipboard, so
 * the remaining collaborators are never called.
 */
function makeService({ clipboard, enabled = true, throws = false }: Options): OmniboxService {
  const deps: OmniboxDeps = {
    history: { topSites: () => [] } as unknown as HistoryService,
    bookmarks: {} as BookmarksService,
    search: {} as SearchService,
    settings: {
      get: () => ({ search: { enableClipboardSuggestions: enabled } }),
    } as unknown as SettingsService,
    tabs: { listAll: () => [] },
    clipboard: {
      readText: () => {
        if (throws) throw new Error('clipboard is locked by another application');
        return clipboard;
      },
    },
  };
  return new OmniboxService(deps);
}

async function clipboardResult(options: Options) {
  const results = await makeService(options).query('', PROFILE, 8);
  return results.find((result) => result.kind === 'clipboard') ?? null;
}

describe('omnibox clipboard suggestion', () => {
  it('offers a URL sitting on the clipboard', async () => {
    const result = await clipboardResult({ clipboard: 'https://example.com/article' });
    expect(result?.url).toBe('https://example.com/article');
    expect(result?.subtitle).toContain('Paste and go');
  });

  it('ranks the clipboard above top sites', async () => {
    const results = await makeService({ clipboard: 'https://example.com' }).query('', PROFILE, 8);
    expect(results[0]?.kind).toBe('clipboard');
  });

  it('normalises a bare host into a URL', async () => {
    expect((await clipboardResult({ clipboard: 'example.com' }))?.url).toBe('https://example.com');
  });

  it('ignores clipboard text that is not a URL', async () => {
    expect(await clipboardResult({ clipboard: 'just some prose, not a url' })).toBeNull();
    expect(await clipboardResult({ clipboard: '' })).toBeNull();
    expect(await clipboardResult({ clipboard: '   ' })).toBeNull();
  });

  it('ignores schemes a click should not follow', async () => {
    // A javascript: or file: URL must never become a one-click suggestion.
    expect(await clipboardResult({ clipboard: 'javascript:alert(1)' })).toBeNull();
    expect(await clipboardResult({ clipboard: 'file:///etc/passwd' })).toBeNull();
  });

  it('ignores an oversized clipboard', async () => {
    const huge = `https://example.com/${'a'.repeat(3000)}`;
    expect(await clipboardResult({ clipboard: huge })).toBeNull();
  });

  it('respects the setting', async () => {
    expect(await clipboardResult({ clipboard: 'https://example.com', enabled: false })).toBeNull();
  });

  it('survives a clipboard that throws', async () => {
    expect(await clipboardResult({ clipboard: '', throws: true })).toBeNull();
  });
});
