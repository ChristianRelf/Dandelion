import type { ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import { DEFAULT_ACCENT } from '@shared/constants';
import { cn } from '../../lib/cn';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { trpc } from '../../lib/trpc/client';
import { useBrowserStore } from '../../stores/browser.store';

/** Space switcher pinned to the bottom of the sidebar. */
export function WorkspaceBar(): ReactElement {
  const workspaces = useBrowserStore(useShallow((state) => state.workspaces));
  const activeId = useBrowserStore((state) => state.activeWorkspaceId);
  const profile = useBrowserStore((state) => state.profile);

  const createWorkspace = async (): Promise<void> => {
    if (!profile) return;
    const workspace = await trpc.workspaces.create.mutate({
      profileId: profile.id,
      name: 'New Space',
      icon: 'sparkles',
      accentColor: DEFAULT_ACCENT,
    });
    await useBrowserStore.getState().refreshWorkspaces();
    await useBrowserStore.getState().switchWorkspace(workspace.id);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-2">
      {workspaces.map((workspace) => {
        const active = workspace.id === activeId;
        return (
          <Tooltip key={workspace.id} content={workspace.name} side="top">
            <button
              type="button"
              onClick={() => void useBrowserStore.getState().switchWorkspace(workspace.id)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                active ? 'bg-surface-active' : 'text-muted hover:bg-surface-hover hover:text-text',
              )}
              style={active ? { color: workspace.accentColor } : undefined}
              aria-label={workspace.name}
            >
              <Icon name={workspace.icon} className="h-[18px] w-[18px]" />
            </button>
          </Tooltip>
        );
      })}
      <Tooltip content="New space" side="top">
        <button
          type="button"
          onClick={() => void createWorkspace()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-hover hover:text-text"
          aria-label="New space"
        >
          <Plus className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}
