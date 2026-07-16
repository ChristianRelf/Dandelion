import type { TabId, WindowId, WorkspaceId } from './ids';
import type { SplitOrientation } from './tab';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowChromeState = 'normal' | 'maximized' | 'minimized' | 'fullscreen';

export interface WindowState {
  id: WindowId;
  bounds: WindowBounds;
  chromeState: WindowChromeState;
  focused: boolean;
  activeWorkspaceId: WorkspaceId | null;
  activeTabId: TabId | null;
  /** Vertical (Arc/Zen) vs horizontal (Chrome) tab strip for this window. */
  tabLayout: 'vertical' | 'horizontal';
  sidebarCollapsed: boolean;
  /** Tabs tiled side-by-side in this window; empty when not split. */
  splitTabIds: TabId[];
  /** Axis the split panes are arranged along. Only meaningful while split. */
  splitOrientation: SplitOrientation;
  /**
   * Share of the content area given to the first pane, as a fraction. Only
   * meaningful for a two-pane split — more panes are always divided evenly.
   */
  splitRatio: number;
}
