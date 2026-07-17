import type { OmniboxResult, Tab } from '@shared/types';
import {
  buildSearchUrl,
  classifyOmniboxInput,
  convertTimezone,
  convertUnits,
  createId,
  evaluateExpression,
  prettifyUrl,
} from '@shared/utils';
import { COMMANDS } from '@shared/constants';
import type { HistoryService } from './history.service';
import type { BookmarksService } from './bookmarks.service';
import type { SearchService } from './search.service';
import type { SettingsService } from './settings.service';

export interface TabsProvider {
  listAll(): Tab[];
}

/** Narrow view of the system clipboard, so the service stays testable. */
export interface ClipboardProvider {
  readText(): string;
}

export interface OmniboxDeps {
  history: HistoryService;
  bookmarks: BookmarksService;
  search: SearchService;
  settings: SettingsService;
  tabs: TabsProvider;
  clipboard: ClipboardProvider;
}

type ResultSeed = Pick<OmniboxResult, 'kind' | 'title' | 'score'> & Partial<OmniboxResult>;

function makeResult(seed: ResultSeed): OmniboxResult {
  return {
    id: createId('r'),
    subtitle: null,
    url: null,
    icon: null,
    inlineCompletion: null,
    actionId: null,
    tabId: null,
    inHistory: false,
    ...seed,
  };
}

/**
 * Aggregates ranked omnibox results from every provider — direct URL, default
 * search, open tabs, history, bookmarks, commands, an offline calculator and
 * unit converter, plus live network search suggestions.
 */
export class OmniboxService {
  constructor(private readonly deps: OmniboxDeps) {}

  async query(input: string, profileId: string, limit: number): Promise<OmniboxResult[]> {
    const trimmed = input.trim();
    if (!trimmed) return this.emptyState(profileId, limit);

    const search = this.deps.settings.get().search;
    const results: OmniboxResult[] = [];
    const intent = classifyOmniboxInput(trimmed);

    // Primary action.
    if (intent.kind === 'url') {
      results.push(
        makeResult({
          kind: 'url',
          title: prettifyUrl(intent.url),
          subtitle: 'Open site',
          url: intent.url,
          icon: 'globe',
          score: 1,
        }),
      );
    } else {
      const engine = this.deps.search.getDefault();
      results.push(
        makeResult({
          kind: 'search',
          title: trimmed,
          subtitle: `Search ${engine.name}`,
          url: buildSearchUrl(engine.searchUrl, trimmed),
          icon: 'search',
          score: 0.95,
        }),
      );
    }

    // Calculator.
    if (search.enableCalculator) {
      const calc = evaluateExpression(trimmed);
      if (calc) {
        results.push(
          makeResult({
            kind: 'calculator',
            title: calc.formatted,
            subtitle: `= ${calc.expression}`,
            icon: 'calculator',
            score: 0.99,
          }),
        );
      }
    }

    // Unit conversion.
    if (search.enableUnitConversion) {
      const conversion = convertUnits(trimmed);
      if (conversion) {
        results.push(
          makeResult({
            kind: 'unitConversion',
            title: `${conversion.formatted} ${conversion.toUnit}`,
            subtitle: conversion.input,
            icon: 'ruler',
            score: 0.99,
          }),
        );
      }
    }

    // Timezone conversion.
    if (search.enableTimezoneConversion) {
      const zoned = convertTimezone(trimmed);
      if (zoned) {
        const dayNote =
          zoned.dayOffset > 0 ? ' (next day)' : zoned.dayOffset < 0 ? ' (previous day)' : '';
        results.push(
          makeResult({
            kind: 'timezone',
            title: `${zoned.formatted}${zoned.abbreviation ? ` ${zoned.abbreviation}` : ''}`,
            subtitle: `${zoned.zoneLabel}${dayNote} · from ${zoned.sourceLabel}`,
            icon: 'clock',
            score: 0.99,
          }),
        );
      }
    }

    // Open tabs.
    const lower = trimmed.toLowerCase();
    for (const tab of this.deps.tabs.listAll()) {
      if (tab.title.toLowerCase().includes(lower) || tab.url.toLowerCase().includes(lower)) {
        results.push(
          makeResult({
            kind: 'openTab',
            title: tab.title || prettifyUrl(tab.url),
            subtitle: `Switch to tab · ${prettifyUrl(tab.url)}`,
            icon: 'panel-top',
            tabId: tab.id,
            score: 0.9,
          }),
        );
      }
      if (results.filter((r) => r.kind === 'openTab').length >= 3) break;
    }

    // History.
    if (search.showHistorySuggestions) {
      for (const entry of this.deps.history.prefixMatch(profileId, trimmed, 4)) {
        results.push(
          makeResult({
            kind: 'history',
            title: entry.title || prettifyUrl(entry.url),
            subtitle: prettifyUrl(entry.url),
            url: entry.url,
            icon: 'history',
            score: 0.72,
          }),
        );
      }
    }

    // Bookmarks.
    if (search.showBookmarkSuggestions) {
      for (const bookmark of this.deps.bookmarks.list(profileId, undefined, trimmed).slice(0, 3)) {
        results.push(
          makeResult({
            kind: 'bookmark',
            title: bookmark.title || prettifyUrl(bookmark.url),
            subtitle: prettifyUrl(bookmark.url),
            url: bookmark.url,
            icon: 'bookmark',
            score: 0.76,
          }),
        );
      }
    }

    // Commands.
    for (const command of COMMANDS) {
      if (!command.palette) continue;
      if (command.title.toLowerCase().includes(lower)) {
        results.push(
          makeResult({
            kind: 'action',
            title: command.title,
            subtitle: 'Run command',
            icon: command.icon,
            actionId: command.id,
            score: 0.55,
          }),
        );
      }
      if (results.filter((r) => r.kind === 'action').length >= 2) break;
    }

    // Live search suggestions (network).
    if (search.searchSuggestions && intent.kind === 'search') {
      const engine = this.deps.search.getDefault();
      for (const suggestion of (await this.fetchSuggestions(trimmed)).slice(0, 4)) {
        if (suggestion.toLowerCase() === lower) continue;
        results.push(
          makeResult({
            kind: 'suggestion',
            title: suggestion,
            subtitle: `Search ${engine.name}`,
            url: buildSearchUrl(engine.searchUrl, suggestion),
            icon: 'search',
            score: 0.66,
          }),
        );
      }
    }

    return this.finalize(results, trimmed, limit);
  }

  private finalize(results: OmniboxResult[], input: string, limit: number): OmniboxResult[] {
    // Deduplicate by destination URL (keep highest score).
    const byKey = new Map<string, OmniboxResult>();
    const historyUrls = new Set<string>();
    for (const result of results) {
      if (result.kind === 'history' && result.url) historyUrls.add(result.url);
      const key = result.url ? `url:${result.url}` : `${result.kind}:${result.title}`;
      const existing = byKey.get(key);
      if (!existing || result.score > existing.score) byKey.set(key, result);
    }

    // Dedupe drops the loser, so a page that is both bookmarked and visited
    // keeps only its bookmark. Carry "this is in history" onto whichever result
    // survived, or the removal action would be absent from the pages that most
    // need it.
    for (const result of byKey.values()) {
      if (result.url && historyUrls.has(result.url)) result.inHistory = true;
    }

    const ranked = [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, limit);

    // Inline autocomplete: complete to the best matching history/URL result.
    const completionSource = ranked.find(
      (r) => r.url && prettifyUrl(r.url).toLowerCase().startsWith(input.toLowerCase()),
    );
    if (completionSource?.url) {
      const pretty = prettifyUrl(completionSource.url);
      const primary = ranked[0];
      if (primary && pretty.toLowerCase().startsWith(input.toLowerCase())) {
        primary.inlineCompletion = pretty.slice(input.length);
      }
    }

    return ranked;
  }

  private emptyState(profileId: string, limit: number): OmniboxResult[] {
    const results: OmniboxResult[] = [];

    const clipboardUrl = this.clipboardUrl();
    if (clipboardUrl) {
      results.push(
        makeResult({
          kind: 'clipboard',
          title: prettifyUrl(clipboardUrl),
          subtitle: 'Paste and go · from your clipboard',
          url: clipboardUrl,
          icon: 'clipboard',
          score: Number.MAX_SAFE_INTEGER,
        }),
      );
    }

    for (const entry of this.deps.history.topSites(profileId, limit)) {
      results.push(
        makeResult({
          kind: 'history',
          title: entry.title || prettifyUrl(entry.url),
          subtitle: prettifyUrl(entry.url),
          url: entry.url,
          icon: 'history',
          score: entry.visitCount,
        }),
      );
    }

    return results.slice(0, limit);
  }

  /**
   * The clipboard's contents, if they are a URL worth offering. Read only when
   * the omnibox opens empty, and never leaves the machine — it is surfaced as a
   * suggestion and nothing more.
   */
  private clipboardUrl(): string | null {
    if (!this.deps.settings.get().search.enableClipboardSuggestions) return null;

    let text: string;
    try {
      text = this.deps.clipboard.readText();
    } catch {
      // A clipboard held by another application can throw; a suggestion is not
      // worth failing the whole omnibox over.
      return null;
    }

    const trimmed = text.trim();
    // Guard against pasting an essay: a URL has no whitespace, and the cap
    // keeps a huge clipboard from being scanned on every keystroke.
    if (!trimmed || trimmed.length > 2048 || /\s/.test(trimmed)) return null;

    const intent = classifyOmniboxInput(trimmed);
    if (intent.kind !== 'url') return null;
    // Only offer schemes a click can safely follow.
    return /^https?:\/\//i.test(intent.url) ? intent.url : null;
  }

  private async fetchSuggestions(query: string): Promise<string[]> {
    const engine = this.deps.search.getDefault();
    if (!engine.suggestUrl) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(buildSearchUrl(engine.suggestUrl, query), {
        signal: controller.signal,
      });
      const data: unknown = await response.json();
      // OpenSearch suggestions: [query, [suggestion, …]].
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return (data[1] as unknown[]).filter((item): item is string => typeof item === 'string');
      }
      return [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
}
