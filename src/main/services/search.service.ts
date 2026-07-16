import type { SearchEngine } from '@shared/types';
import { DEFAULT_SEARCH_ENGINES } from '@shared/constants';
import { buildSearchUrl, classifyOmniboxInput, createId } from '@shared/utils';
import type { Repositories } from '../storage';
import type { SettingsService } from './settings.service';

export interface ResolvedQuery {
  url: string;
  engine: SearchEngine | null;
  isSearch: boolean;
}

/** Manages search engines and resolves omnibox input (incl. `!bang` keywords). */
export class SearchService {
  constructor(
    private readonly repos: Repositories,
    private readonly settings: SettingsService,
  ) {
    if (this.repos.searchEngines.isEmpty()) {
      this.repos.searchEngines.seed(DEFAULT_SEARCH_ENGINES);
    }
  }

  listEngines(): SearchEngine[] {
    return this.repos.searchEngines.list();
  }

  getDefault(): SearchEngine {
    const configuredId = this.settings.get().search.defaultEngineId;
    return (
      this.repos.searchEngines.get(configuredId) ??
      this.repos.searchEngines.getDefault() ??
      this.repos.searchEngines.list()[0]!
    );
  }

  setDefault(id: string): void {
    this.repos.searchEngines.setDefault(id);
    this.settings.update({ search: { defaultEngineId: id } });
  }

  getByKeyword(keyword: string): SearchEngine | null {
    return this.repos.searchEngines.getByKeyword(keyword);
  }

  addEngine(input: {
    name: string;
    keyword: string;
    searchUrl: string;
    suggestUrl: string | null;
  }): SearchEngine {
    const engine: SearchEngine = {
      id: createId('engine'),
      name: input.name,
      keyword: input.keyword,
      searchUrl: input.searchUrl,
      suggestUrl: input.suggestUrl,
      favicon: null,
      isDefault: false,
      isBuiltIn: false,
    };
    this.repos.searchEngines.insert(engine, this.repos.searchEngines.list().length);
    return engine;
  }

  removeEngine(id: string): void {
    this.repos.searchEngines.remove(id);
  }

  /** Turn raw omnibox text into a navigable URL, honouring `<keyword> query`. */
  resolve(input: string): ResolvedQuery {
    const trimmed = input.trim();
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex > 0) {
      const keyword = trimmed.slice(0, spaceIndex);
      const engine = this.repos.searchEngines.getByKeyword(keyword);
      if (engine) {
        return {
          url: buildSearchUrl(engine.searchUrl, trimmed.slice(spaceIndex + 1)),
          engine,
          isSearch: true,
        };
      }
    }

    const intent = classifyOmniboxInput(trimmed);
    if (intent.kind === 'url') {
      return { url: intent.url, engine: null, isSearch: false };
    }
    const engine = this.getDefault();
    return { url: buildSearchUrl(engine.searchUrl, intent.query), engine, isSearch: true };
  }
}
