import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Dialog from '@radix-ui/react-dialog';
import type { Workspace } from '@shared/types';
import { DEFAULT_ACCENT } from '@shared/constants';
import { cn } from '../../lib/cn';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import { toast } from '../../stores/toast.store';
import { trpc } from '../../lib/trpc/client';
import { useBrowserStore } from '../../stores/browser.store';
import { menuContentClass, menuItemClass, menuItemDangerClass, menuSeparatorClass } from '../ui/menu-styles';

const ACCENTS = ['#f5c451', '#60a5fa', '#4ade80', '#f472b6', '#a78bfa', '#22d3ee', '#fb923c', '#f87171'];

/** Space switcher pinned to the bottom of the sidebar, with rename/recolour/reorder. */
export function WorkspaceBar(): ReactElement {
  const workspaces = useBrowserStore(useShallow((state) => state.workspaces));
  const activeId = useBrowserStore((state) => state.activeWorkspaceId);
  const profile = useBrowserStore((state) => state.profile);
  const [renaming, setRenaming] = useState<Workspace | null>(null);
  const [name, setName] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setName(renaming.name);
      requestAnimationFrame(() => renameRef.current?.select());
    }
  }, [renaming]);

  const refresh = (): Promise<void> => useBrowserStore.getState().refreshWorkspaces();

  const createWorkspace = async (): Promise<void> => {
    if (!profile) return;
    const workspace = await trpc.workspaces.create.mutate({
      profileId: profile.id,
      name: 'New Space',
      icon: 'sparkles',
      accentColor: ACCENTS[workspaces.length % ACCENTS.length] ?? DEFAULT_ACCENT,
    });
    await refresh();
    await useBrowserStore.getState().switchWorkspace(workspace.id);
  };

  const commitRename = (): void => {
    const workspace = renaming;
    setRenaming(null);
    const trimmed = name.trim();
    if (workspace && trimmed && trimmed !== workspace.name) {
      void trpc.workspaces.update
        .mutate({ workspaceId: workspace.id, name: trimmed })
        .then(refresh)
        .catch(() => toast.error('Could not rename space'));
    }
  };

  const setAccent = (workspace: Workspace, accentColor: string): void => {
    void trpc.workspaces.update
      .mutate({ workspaceId: workspace.id, accentColor })
      .then(refresh)
      .catch(() => toast.error('Could not update space'));
  };

  const remove = (workspace: Workspace): void => {
    void trpc.workspaces.delete
      .mutate({ workspaceId: workspace.id })
      .then(async () => {
        await refresh();
        const next = useBrowserStore.getState().workspaces[0];
        if (next) await useBrowserStore.getState().switchWorkspace(next.id);
        toast.success('Space deleted');
      })
      .catch(() => toast.error('Could not delete space'));
  };

  const onDrop = (target: Workspace): void => {
    if (!dragId || dragId === target.id) return;
    const ids = workspaces.map((workspace) => workspace.id).filter((id) => id !== dragId);
    const pos = ids.indexOf(target.id);
    ids.splice(pos < 0 ? ids.length : pos, 0, dragId);
    void trpc.workspaces.reorder.mutate({ orderedIds: ids }).then(refresh);
    setDragId(null);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-2">
      {workspaces.map((workspace) => {
        const active = workspace.id === activeId;
        return (
          <ContextMenu.Root key={workspace.id}>
            <ContextMenu.Trigger asChild>
              <button
                type="button"
                draggable
                onDragStart={() => setDragId(workspace.id)}
                onDragOver={(event) => dragId && event.preventDefault()}
                onDrop={() => onDrop(workspace)}
                onDragEnd={() => setDragId(null)}
                onClick={() => void useBrowserStore.getState().switchWorkspace(workspace.id)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-[background-color,color] duration-[var(--duration-fast)] active:scale-95',
                  active ? 'bg-surface-active' : 'text-muted hover:bg-surface-hover hover:text-text',
                  dragId === workspace.id && 'opacity-40',
                )}
                style={active ? { color: workspace.accentColor } : undefined}
                aria-label={workspace.name}
                title={workspace.name}
              >
                <Icon name={workspace.icon} className="h-[18px] w-[18px]" />
              </button>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className={menuContentClass}>
                <ContextMenu.Item className={menuItemClass} onSelect={() => setRenaming(workspace)}>
                  Rename space
                </ContextMenu.Item>
                <ContextMenu.Label className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-faint">
                  Accent colour
                </ContextMenu.Label>
                <div className="flex flex-wrap gap-1.5 px-2.5 pb-1.5">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent}
                      type="button"
                      onClick={() => setAccent(workspace, accent)}
                      aria-label={`Set accent ${accent}`}
                      className={cn(
                        'h-5 w-5 rounded-full ring-offset-1 ring-offset-bg-elevated transition-transform hover:scale-110',
                        workspace.accentColor.toLowerCase() === accent && 'ring-2 ring-text',
                      )}
                      style={{ backgroundColor: accent }}
                    />
                  ))}
                </div>
                <ContextMenu.Separator className={menuSeparatorClass} />
                <ContextMenu.Item
                  className={menuItemDangerClass}
                  disabled={workspaces.length <= 1}
                  onSelect={() => remove(workspace)}
                >
                  Delete space
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        );
      })}
      <Tooltip content="New space" side="top">
        <button
          type="button"
          onClick={() => void createWorkspace()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors duration-[var(--duration-fast)] hover:bg-surface-hover hover:text-text active:scale-95"
          aria-label="New space"
        >
          <Plus className="h-4 w-4" />
        </button>
      </Tooltip>

      <Dialog.Root open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:animate-[fade-in_120ms_ease-out]" />
          <Dialog.Content className="animate-pop fixed top-1/2 left-1/2 z-[101] w-[360px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line p-5 shadow-[var(--shadow-lg)] glass-strong">
            <Dialog.Title className="text-[15px] font-semibold text-text">Rename space</Dialog.Title>
            <input
              ref={renameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitRename();
              }}
              maxLength={80}
              className="mt-4 w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={commitRename}>
                Save
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
