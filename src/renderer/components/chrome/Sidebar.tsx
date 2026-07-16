import { useMemo, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import type { Tab } from '@shared/types';
import { trpc } from '../../lib/trpc/client';
import { useBrowserStore } from '../../stores/browser.store';
import { useGroups, useOrderedTabs } from '../../hooks/useBrowser';
import { TAB_GROUP_COLORS } from '../../lib/tab-colors';
import { TabItem } from './TabItem';
import { TabGroupHeader } from './TabGroupHeader';
import { WorkspaceBar } from './WorkspaceBar';

const END = '__end__';

const itemMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 34 },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
};

/** The vertical (Arc/Zen-style) sidebar: pinned tabs, groups, tabs and spaces. */
export function Sidebar(): ReactElement {
  const tabs = useOrderedTabs();
  const groups = useGroups();
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const activeWorkspaceId = useBrowserStore((state) => state.activeWorkspaceId);
  const [drag, setDrag] = useState<{ id: string; overId: string | null } | null>(null);

  const { pinned, grouped, ungrouped } = useMemo(() => {
    const pinnedTabs = tabs.filter((tab) => tab.pinned);
    const groupedMap = new Map<string, Tab[]>();
    for (const tab of tabs) {
      if (!tab.pinned && tab.groupId) {
        const list = groupedMap.get(tab.groupId) ?? [];
        list.push(tab);
        groupedMap.set(tab.groupId, list);
      }
    }
    return {
      pinned: pinnedTabs,
      grouped: groupedMap,
      ungrouped: tabs.filter((tab) => !tab.pinned && !tab.groupId),
    };
  }, [tabs]);

  const newTab = (): void => {
    if (activeWorkspaceId)
      void trpc.tabs.create.mutate({ workspaceId: activeWorkspaceId, active: true });
  };

  const dropAt = (targetId: string): void => {
    if (!drag || !activeWorkspaceId) return;
    const ids = tabs.map((tab) => tab.id).filter((id) => id !== drag.id);
    if (targetId === END) ids.push(drag.id);
    else {
      const pos = ids.indexOf(targetId);
      ids.splice(pos < 0 ? ids.length : pos, 0, drag.id);
    }
    void trpc.tabs.reorder.mutate({ workspaceId: activeWorkspaceId, orderedTabIds: ids });
    setDrag(null);
  };

  const dragProps = (tab: Tab) => ({
    draggable: true,
    dragging: drag?.id === tab.id,
    dropBefore: !!drag && drag.id !== tab.id && drag.overId === tab.id,
    onDragStart: () => setDrag({ id: tab.id, overId: null }),
    onDragEnter: () => setDrag((current) => (current ? { ...current, overId: tab.id } : null)),
    onDragEnd: () => setDrag(null),
    onDrop: () => dropAt(tab.id),
  });

  const closeGroup = (groupId: string): void => {
    for (const tab of grouped.get(groupId) ?? []) void trpc.tabs.close.mutate({ tabId: tab.id });
    void trpc.tabs.removeGroup.mutate({ groupId });
  };

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Tabs"
        className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-1 pb-1"
      >
        {pinned.length > 0 && (
          <div className="mb-1 flex flex-col gap-0.5 border-b border-line pb-1.5">
            {pinned.map((tab) => (
              <TabItem key={tab.id} tab={tab} active={tab.id === activeTabId} />
            ))}
          </div>
        )}

        {groups.map((group) => {
          const members = grouped.get(group.id) ?? [];
          if (members.length === 0) return null;
          return (
            <div key={group.id} className="flex flex-col">
              <TabGroupHeader
                group={group}
                count={members.length}
                onCloseGroup={() => closeGroup(group.id)}
              />
              {!group.collapsed &&
                members.map((tab) => (
                  <div key={tab.id} className="pl-2">
                    <TabItem
                      tab={tab}
                      active={tab.id === activeTabId}
                      groupColor={TAB_GROUP_COLORS[group.color].hex}
                    />
                  </div>
                ))}
            </div>
          );
        })}

        <AnimatePresence initial={false}>
          {ungrouped.map((tab) => (
            <motion.div key={tab.id} layout {...itemMotion} className="overflow-hidden">
              <TabItem tab={tab} active={tab.id === activeTabId} {...dragProps(tab)} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Drop zone for appending to the end of the list. */}
        <div
          className="min-h-6 flex-1"
          onDragOver={(event) => drag && event.preventDefault()}
          onDrop={() => dropAt(END)}
        />
      </div>

      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={newTab}
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-faint transition-colors duration-[var(--duration-fast)] hover:bg-surface-hover hover:text-text active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" /> New Tab
        </button>
      </div>

      <WorkspaceBar />
    </aside>
  );
}
