import { create } from 'zustand';

interface UiStore {
  /** Omnibox (address bar / command bar) is focused and showing results. */
  omniboxOpen: boolean;
  omniboxInitialValue: string;
  /** Raycast-style command palette. */
  paletteOpen: boolean;
  /** Quick tab switcher (MRU). */
  tabSwitcherOpen: boolean;
  /** Saved-sessions manager dialog. */
  sessionsOpen: boolean;
  /** In-page find bar. */
  findOpen: boolean;
  /** A site-permission prompt is currently on screen. */
  permissionActive: boolean;
  /** AI assistant sidebar. */
  aiSidebarOpen: boolean;
  /** Manual sidebar collapse. */
  sidebarCollapsed: boolean;
  /** Tabs currently tiled side-by-side (renderer mirror of the split). */
  splitTabIds: string[];

  openOmnibox: (initialValue?: string) => void;
  closeOmnibox: () => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  openTabSwitcher: () => void;
  closeTabSwitcher: () => void;
  openSessions: () => void;
  closeSessions: () => void;
  openFind: () => void;
  toggleFind: () => void;
  closeFind: () => void;
  setPermissionActive: (active: boolean) => void;
  toggleAiSidebar: () => void;
  setAiSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSplitTabIds: (ids: string[]) => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  omniboxOpen: false,
  omniboxInitialValue: '',
  paletteOpen: false,
  tabSwitcherOpen: false,
  sessionsOpen: false,
  findOpen: false,
  permissionActive: false,
  aiSidebarOpen: false,
  sidebarCollapsed: false,
  splitTabIds: [],

  openOmnibox: (initialValue = '') =>
    set({ omniboxOpen: true, omniboxInitialValue: initialValue, paletteOpen: false }),
  closeOmnibox: () => set({ omniboxOpen: false }),
  openPalette: () => set({ paletteOpen: true, omniboxOpen: false, tabSwitcherOpen: false }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen, omniboxOpen: false }),
  openTabSwitcher: () => set({ tabSwitcherOpen: true, paletteOpen: false, omniboxOpen: false }),
  closeTabSwitcher: () => set({ tabSwitcherOpen: false }),
  openSessions: () => set({ sessionsOpen: true, paletteOpen: false }),
  closeSessions: () => set({ sessionsOpen: false }),
  openFind: () => set({ findOpen: true }),
  toggleFind: () => set({ findOpen: !get().findOpen }),
  closeFind: () => set({ findOpen: false }),
  setPermissionActive: (permissionActive) => set({ permissionActive }),
  toggleAiSidebar: () => set({ aiSidebarOpen: !get().aiSidebarOpen }),
  setAiSidebarOpen: (aiSidebarOpen) => set({ aiSidebarOpen }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  setSplitTabIds: (splitTabIds) => set({ splitTabIds }),
}));

/**
 * Web content is dimmed/hidden when a full-window overlay is active. A pending
 * permission prompt uses the same treatment so it reads as a focused modal
 * instead of being occluded by the native web view.
 */
export function selectContentDimmed(state: UiStore): boolean {
  return (
    state.omniboxOpen || state.paletteOpen || state.tabSwitcherOpen || state.permissionActive
  );
}

/**
 * Pixels to reserve at the top of the content area for the in-content find bar.
 * The main process insets the web view by this much so the bar is never
 * occluded by native content while the page stays visible.
 */
export function selectContentTopInset(state: UiStore): number {
  return state.findOpen ? 52 : 0;
}
