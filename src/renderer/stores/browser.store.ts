import { create } from 'zustand';
import type {
  BrowserEvent,
  Profile,
  Settings,
  SettingsPatch,
  Tab,
  TabGroup,
  VaultState,
  WindowState,
  Workspace,
} from '@shared/types';
import { trpc } from '../lib/trpc/client';

function keyBy<T extends { id: string }>(items: T[]): Record<string, T> {
  const record: Record<string, T> = {};
  for (const item of items) record[item.id] = item;
  return record;
}

interface BrowserStore {
  ready: boolean;
  windowId: string;
  profile: Profile | null;
  profiles: Profile[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeTabId: string | null;
  tabs: Record<string, Tab>;
  groups: Record<string, TabGroup>;
  settings: Settings | null;
  vault: VaultState | null;
  windowState: WindowState | null;

  bootstrap: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  patchSettings: (patch: SettingsPatch) => Promise<void>;
  applyEvent: (event: BrowserEvent) => void;
}

/**
 * The renderer's mirror of main-process browser state for the current window.
 * State is hydrated once via `bootstrap` and then kept live by `applyEvent`,
 * which is fed from the main → renderer event channel.
 */
export const useBrowserStore = create<BrowserStore>((set, get) => ({
  ready: false,
  windowId: typeof window !== 'undefined' ? (window.dandelion?.windowId ?? '') : '',
  profile: null,
  profiles: [],
  workspaces: [],
  activeWorkspaceId: null,
  activeTabId: null,
  tabs: {},
  groups: {},
  settings: null,
  vault: null,
  windowState: null,

  bootstrap: async () => {
    const state = await trpc.app.initialState.query();
    set({
      windowId: state.windowId ?? window.dandelion.windowId,
      profile: state.profile,
      profiles: state.profiles,
      workspaces: state.workspaces,
      activeWorkspaceId: state.activeWorkspaceId,
      settings: state.settings,
      vault: state.vault,
      windowState: state.window,
      activeTabId: state.window?.activeTabId ?? null,
    });

    if (state.activeWorkspaceId) {
      const { tabs, groups } = await trpc.app.restoreWorkspace.mutate({
        workspaceId: state.activeWorkspaceId,
      });
      set({ tabs: keyBy(tabs), groups: keyBy(groups) });
    }
    set({ ready: true });
  },

  switchWorkspace: async (workspaceId) => {
    const { tabs, groups } = await trpc.app.restoreWorkspace.mutate({ workspaceId });
    set({ activeWorkspaceId: workspaceId, tabs: keyBy(tabs), groups: keyBy(groups) });
  },

  refreshWorkspaces: async () => {
    const { profile } = get();
    if (!profile) return;
    set({ workspaces: await trpc.workspaces.list.query({ profileId: profile.id }) });
  },

  patchSettings: async (patch) => {
    const settings = await trpc.settings.update.mutate(patch);
    set({ settings });
  },

  applyEvent: (event) => {
    const state = get();
    switch (event.type) {
      case 'tab:created':
      case 'tab:updated': {
        if (event.tab.workspaceId !== state.activeWorkspaceId) return;
        set({ tabs: { ...state.tabs, [event.tab.id]: event.tab } });
        return;
      }
      case 'tab:removed': {
        if (!(event.tabId in state.tabs)) return;
        const next = { ...state.tabs };
        delete next[event.tabId];
        set({ tabs: next });
        return;
      }
      case 'tab:activated': {
        if (event.windowId === state.windowId) set({ activeTabId: event.tabId });
        return;
      }
      case 'tabGroup:changed': {
        set({ groups: { ...state.groups, [event.group.id]: event.group } });
        return;
      }
      case 'tabGroup:removed': {
        const next = { ...state.groups };
        delete next[event.groupId];
        set({ groups: next });
        return;
      }
      case 'workspace:changed': {
        set({
          workspaces: state.workspaces.map((workspace) =>
            workspace.id === event.workspace.id ? event.workspace : workspace,
          ),
        });
        return;
      }
      case 'window:state': {
        if (event.window.id !== state.windowId) return;
        set({
          windowState: event.window,
          activeTabId: event.window.activeTabId,
          activeWorkspaceId: event.window.activeWorkspaceId ?? state.activeWorkspaceId,
        });
        return;
      }
      case 'vault:state': {
        set({ vault: event.state });
        return;
      }
      default:
        return;
    }
  },
}));

/** Tabs of the active workspace, ordered and split into pinned/regular. */
export function selectOrderedTabs(state: BrowserStore): Tab[] {
  return Object.values(state.tabs)
    .filter((tab) => tab.workspaceId === state.activeWorkspaceId)
    .sort((a, b) => a.index - b.index);
}

/**
 * The accent colour currently in effect: the active workspace's accent when
 * "follow workspace accent" is on, otherwise the global setting. Returned as a
 * plain string so subscribers only re-render when the colour actually changes.
 */
export function selectAccent(state: BrowserStore): string | null {
  const settings = state.settings;
  if (!settings) return null;
  if (settings.appearance.followWorkspaceAccent) {
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (workspace) return workspace.accentColor;
  }
  return settings.appearance.accentColor;
}
