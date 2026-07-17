import type { TabId } from './ids';

export type OmniboxResultKind =
  | 'search'
  | 'url'
  | 'history'
  | 'bookmark'
  | 'openTab'
  | 'calculator'
  | 'unitConversion'
  | 'timezone'
  | 'clipboard'
  | 'weather'
  | 'action'
  | 'ai'
  | 'suggestion';

/**
 * A single ranked entry in the omnibox dropdown. The renderer requests results
 * from the main process on each keystroke; ranking and provider aggregation
 * happen in the `OmniboxService`.
 */
export interface OmniboxResult {
  id: string;
  kind: OmniboxResultKind;
  title: string;
  subtitle: string | null;
  /** Destination URL for navigable results, else `null`. */
  url: string | null;
  /** Lucide icon name or favicon URL. */
  icon: string | null;
  /** Relevance score in [0, 1]; the list is sorted descending. */
  score: number;
  /** Tail text to inline-complete the input with, if applicable. */
  inlineCompletion: string | null;
  /** Command identifier for `action` results. */
  actionId: string | null;
  /** Target tab for `openTab` results. */
  tabId: TabId | null;
  /**
   * Whether this result's URL is in history, and so can be removed from it.
   *
   * Not the same as `kind === 'history'`: results are deduplicated by URL and
   * the highest score wins, so a page that is both bookmarked and visited
   * surfaces as a `bookmark` and its history twin is dropped. Without this the
   * "remove from history" action would be missing on precisely the pages most
   * worth scrubbing — the ones visited often enough to have been bookmarked.
   */
  inHistory: boolean;
}

export interface OmniboxQuery {
  input: string;
  /** Caret position, used to decide whether to offer inline completion. */
  cursor: number;
  limit: number;
}
