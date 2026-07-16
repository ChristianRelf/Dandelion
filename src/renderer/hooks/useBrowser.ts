import { useShallow } from 'zustand/react/shallow';
import type { Tab, TabGroup, Workspace } from '@shared/types';
import { selectOrderedTabs, useBrowserStore } from '../stores/browser.store';

export function useActiveTab(): Tab | null {
  return useBrowserStore((state) =>
    state.activeTabId ? (state.tabs[state.activeTabId] ?? null) : null,
  );
}

export function useOrderedTabs(): Tab[] {
  return useBrowserStore(useShallow(selectOrderedTabs));
}

export function useActiveWorkspace(): Workspace | null {
  return useBrowserStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? null,
  );
}

export function useGroups(): TabGroup[] {
  return useBrowserStore(
    useShallow((state) => Object.values(state.groups).sort((a, b) => a.index - b.index)),
  );
}
