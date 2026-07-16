import type { TabId, WindowId, WorkspaceId } from './ids';

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
}
