import type { ReactElement } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Check } from 'lucide-react';
import type { Tab } from '@shared/types';
import { trpc } from '../../lib/trpc/client';
import { useGroups } from '../../hooks/useBrowser';
import { nextGroupColor, TAB_GROUP_COLORS } from '../../lib/tab-colors';
import {
  menuContentClass,
  menuItemClass,
  menuItemDangerClass,
  menuSeparatorClass,
} from '../ui/menu-styles';

const subContentClass = menuContentClass;

/** Shared right-click menu for a tab, used by both the vertical and horizontal strips. */
export function TabContextMenu({
  tab,
  children,
}: {
  tab: Tab;
  children: ReactElement;
}): ReactElement {
  const groups = useGroups().filter((group) => group.workspaceId === tab.workspaceId);

  // Both used to walk the store and fire one `tabs.close` per tab — N round
  // trips for one intent, against a list main re-indexes as it goes. Main owns
  // the ordering, so it resolves the set and closes it in one call.
  const closeOthers = (): void => void trpc.tabs.closeOthers.mutate({ tabId: tab.id });
  const closeToRight = (): void => void trpc.tabs.closeToRight.mutate({ tabId: tab.id });
  const addToNewGroup = (): void => {
    void trpc.tabs.createGroup.mutate({
      workspaceId: tab.workspaceId,
      name: 'New group',
      color: nextGroupColor(groups.length),
      tabIds: [tab.id],
    });
  };
  const moveToGroup = (groupId: string | null): void => {
    void trpc.tabs.move.mutate({ tabId: tab.id, toIndex: tab.index, groupId });
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menuContentClass}>
          <ContextMenu.Item
            className={menuItemClass}
            onSelect={() => void trpc.tabs.duplicate.mutate({ tabId: tab.id })}
          >
            Duplicate
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItemClass}
            onSelect={() => void trpc.tabs.setPinned.mutate({ tabId: tab.id, pinned: !tab.pinned })}
          >
            {tab.pinned ? 'Unpin tab' : 'Pin tab'}
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItemClass}
            onSelect={() => void trpc.tabs.setMuted.mutate({ tabId: tab.id, muted: !tab.muted })}
          >
            {tab.muted ? 'Unmute site' : 'Mute site'}
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItemClass}
            onSelect={() => void trpc.tabs.sleep.mutate({ tabId: tab.id })}
          >
            Put to sleep
          </ContextMenu.Item>

          <ContextMenu.Separator className={menuSeparatorClass} />

          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className={menuItemClass}>Add to group…</ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className={subContentClass} sideOffset={4}>
                <ContextMenu.Item className={menuItemClass} onSelect={addToNewGroup}>
                  New group
                </ContextMenu.Item>
                {groups.length > 0 && <ContextMenu.Separator className={menuSeparatorClass} />}
                {groups.map((group) => (
                  <ContextMenu.Item
                    key={group.id}
                    className={menuItemClass}
                    onSelect={() => moveToGroup(group.id)}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: TAB_GROUP_COLORS[group.color].hex }}
                    />
                    <span className="min-w-0 flex-1 truncate">{group.name || 'Group'}</span>
                    {tab.groupId === group.id && <Check className="h-3.5 w-3.5 text-accent" />}
                  </ContextMenu.Item>
                ))}
                {tab.groupId && (
                  <>
                    <ContextMenu.Separator className={menuSeparatorClass} />
                    <ContextMenu.Item className={menuItemClass} onSelect={() => moveToGroup(null)}>
                      Remove from group
                    </ContextMenu.Item>
                  </>
                )}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>

          <ContextMenu.Separator className={menuSeparatorClass} />

          <ContextMenu.Item className={menuItemClass} onSelect={closeOthers}>
            Close other tabs
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemClass} onSelect={closeToRight}>
            Close tabs to the right
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItemDangerClass}
            onSelect={() => void trpc.tabs.close.mutate({ tabId: tab.id })}
          >
            Close tab
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
