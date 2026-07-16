import type { BrowserWindow } from 'electron';
import type {
  SplitOrientation,
  TabId,
  WindowBounds,
  WindowChromeState,
  WindowState,
  WorkspaceId,
} from '@shared/types';

/**
 * A chrome window. Wraps the Electron {@link BrowserWindow} that renders the
 * React UI and carries the runtime state the TabManager needs to lay out tab
 * content views (which are children of this window's `contentView`).
 */
export class DandelionWindow {
  /** Pixel rect, in window coordinates, where tab web content should render. */
  contentBounds: WindowBounds = { x: 0, y: 0, width: 0, height: 0 };
  activeWorkspaceId: WorkspaceId | null = null;
  activeTabId: TabId | null = null;
  tabLayout: 'vertical' | 'horizontal';
  sidebarCollapsed = false;
  /** Tabs shown side-by-side in split view (empty when not split). */
  splitTabIds: TabId[] = [];
  /** Axis {@link splitTabIds} are arranged along. Sticky, so re-splitting keeps the last choice. */
  splitOrientation: SplitOrientation = 'vertical';
  /** Share of the content area for the first pane. Sticky, like the orientation. */
  splitRatio = 0.5;
  /**
   * When true, active tab web content is hidden so full-window chrome overlays
   * (command palette, omnibox results, modals) render unobstructed — producing
   * the dimmed "command bar" effect.
   */
  contentHidden = false;

  constructor(
    readonly id: string,
    readonly browserWindow: BrowserWindow,
    tabLayout: 'vertical' | 'horizontal',
  ) {
    this.tabLayout = tabLayout;
  }

  chromeState(): WindowChromeState {
    const window = this.browserWindow;
    if (window.isFullScreen()) return 'fullscreen';
    if (window.isMinimized()) return 'minimized';
    if (window.isMaximized()) return 'maximized';
    return 'normal';
  }

  toState(): WindowState {
    return {
      id: this.id,
      bounds: this.browserWindow.getBounds(),
      chromeState: this.chromeState(),
      focused: this.browserWindow.isFocused(),
      activeWorkspaceId: this.activeWorkspaceId,
      activeTabId: this.activeTabId,
      tabLayout: this.tabLayout,
      sidebarCollapsed: this.sidebarCollapsed,
      splitTabIds: [...this.splitTabIds],
      splitOrientation: this.splitOrientation,
      splitRatio: this.splitRatio,
    };
  }
}
