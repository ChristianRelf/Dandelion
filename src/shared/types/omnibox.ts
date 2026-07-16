import type { TabId } from './ids';

export type OmniboxResultKind =
  | 'search'
  | 'url'
  | 'history'
  | 'bookmark'
  | 'openTab'
  | 'calculator'
  | 'unitConversion'
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
}

export interface OmniboxQuery {
  input: string;
  /** Caret position, used to decide whether to offer inline completion. */
  cursor: number;
  limit: number;
}
