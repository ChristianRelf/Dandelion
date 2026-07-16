import type { SearchEngine } from '../types/search';

/**
 * Built-in search engines. `%s` is replaced with the URL-encoded query. Suggest
 * endpoints return provider-specific JSON parsed by the `SuggestionsService`.
 */
export const DEFAULT_SEARCH_ENGINES: readonly SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    keyword: 'g',
    searchUrl: 'https://www.google.com/search?q=%s',
    suggestUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s',
    favicon: null,
    isDefault: true,
    isBuiltIn: true,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    keyword: 'ddg',
    searchUrl: 'https://duckduckgo.com/?q=%s',
    suggestUrl: 'https://duckduckgo.com/ac/?q=%s&type=list',
    favicon: null,
    isDefault: false,
    isBuiltIn: true,
  },
  {
    id: 'bing',
    name: 'Bing',
    keyword: 'b',
    searchUrl: 'https://www.bing.com/search?q=%s',
    suggestUrl: 'https://www.bing.com/osjson.aspx?query=%s',
    favicon: null,
    isDefault: false,
    isBuiltIn: true,
  },
  {
    id: 'brave',
    name: 'Brave Search',
    keyword: 'br',
    searchUrl: 'https://search.brave.com/search?q=%s',
    suggestUrl: 'https://search.brave.com/api/suggest?q=%s',
    favicon: null,
    isDefault: false,
    isBuiltIn: true,
  },
  {
    id: 'kagi',
    name: 'Kagi',
    keyword: 'k',
    searchUrl: 'https://kagi.com/search?q=%s',
    suggestUrl: null,
    favicon: null,
    isDefault: false,
    isBuiltIn: true,
  },
  {
    id: 'searxng',
    name: 'SearXNG',
    keyword: 'sx',
    searchUrl: 'https://searx.be/search?q=%s',
    suggestUrl: null,
    favicon: null,
    isDefault: false,
    isBuiltIn: true,
  },
] as const;

export const DEFAULT_SEARCH_ENGINE_ID = 'google';
