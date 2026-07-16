import type { TabGroupId, TabId, WindowId, WorkspaceId } from './ids';

export type TabStatus = 'idle' | 'loading' | 'complete' | 'crashed';

export interface TabNavigationState {
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

/**
 * The complete, serialisable state of a browser tab. This object is the single
 * source of truth held in the main process and mirrored into the renderer via
 * the tab store — it must remain plain, structured-clone-safe data.
 */
export interface Tab {
  id: TabId;
  workspaceId: WorkspaceId;
  /** The window currently hosting this tab, or `null` when parked/saved. */
  windowId: WindowId | null;
  /** Owning tab group, or `null` when ungrouped. */
  groupId: TabGroupId | null;
  /** Ordinal position within its workspace column / group. */
  index: number;

  url: string;
  /** URL that is loading but not yet committed (shown optimistically). */
  pendingUrl: string | null;
  title: string;
  favicon: string | null;
  /** `<meta name="theme-color">` value, used to tint the chrome. */
  themeColor: string | null;

  status: TabStatus;
  navigation: TabNavigationState;
  /** 0–1 load progress for the progress affordance. */
  loadingProgress: number;

  audible: boolean;
  muted: boolean;
  pinned: boolean;
  /** Discarded/sleeping — memory freed, restored on activation. */
  asleep: boolean;

  createdAt: number;
  lastActiveAt: number;
  openerTabId: TabId | null;
}

export type TabGroupColor =
  'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

export interface TabGroup {
  id: TabGroupId;
  workspaceId: WorkspaceId;
  name: string;
  color: TabGroupColor;
  collapsed: boolean;
  index: number;
  createdAt: number;
}

export type SplitOrientation = 'horizontal' | 'vertical';

/** A side-by-side arrangement of 2+ tabs within a single window. */
export interface SplitViewLayout {
  id: string;
  windowId: WindowId;
  orientation: SplitOrientation;
  tabIds: TabId[];
  /** Fractional pane sizes, parallel to `tabIds`, summing to ~1. */
  sizes: number[];
}

/** A captured raster preview of a tab, used for hover previews and the switcher. */
export interface TabThumbnail {
  tabId: TabId;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: number;
}

export type ReaderBlockType = 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blockquote' | 'pre' | 'img';

/** A single extracted content block for reader mode (plain text, never raw HTML). */
export interface ReaderBlock {
  type: ReaderBlockType;
  text?: string;
  src?: string;
  alt?: string;
}

/** Distilled, reader-friendly article content extracted from a page. */
export interface ReaderArticle {
  url: string;
  title: string;
  byline: string;
  siteName: string;
  blocks: ReaderBlock[];
  /** Total character length of the extracted text (for read-time estimates). */
  length: number;
  excerpt: string;
}

/** A recently-closed tab retained for restoration (Ctrl/Cmd+Shift+T). */
export interface ClosedTab {
  url: string;
  title: string;
  favicon: string | null;
  workspaceId: WorkspaceId;
  groupId: TabGroupId | null;
  pinned: boolean;
  index: number;
  closedAt: number;
}
