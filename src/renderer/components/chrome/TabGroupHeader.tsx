import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ChevronRight } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { TabGroup } from '@shared/types';
import { cn } from '../../lib/cn';
import { trpc } from '../../lib/trpc/client';
import { TAB_GROUP_COLORS, TAB_GROUP_COLOR_ORDER } from '../../lib/tab-colors';
import { menuContentClass, menuItemClass, menuSeparatorClass } from '../ui/menu-styles';

interface TabGroupHeaderProps {
  group: TabGroup;
  count: number;
  /** Close every tab in the group, then delete the group. */
  onCloseGroup: () => void;
}

/** Collapsible header for a tab group: colour dot, editable name, tab count. */
export function TabGroupHeader({ group, count, onCloseGroup }: TabGroupHeaderProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(group.name), [group.name]);
  useEffect(() => {
    if (editing) requestAnimationFrame(() => inputRef.current?.select());
  }, [editing]);

  const commitName = (): void => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== group.name) {
      void trpc.tabs.updateGroup.mutate({ groupId: group.id, name: trimmed });
    } else {
      setName(group.name);
    }
  };

  const color = TAB_GROUP_COLORS[group.color];

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="group/header flex h-7 items-center gap-1.5 rounded-lg px-1.5 text-[12px] font-medium text-muted">
          <button
            type="button"
            onClick={() =>
              void trpc.tabs.updateGroup.mutate({ groupId: group.id, collapsed: !group.collapsed })
            }
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-0.5 transition-colors hover:text-text"
            aria-expanded={!group.collapsed}
          >
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-[var(--duration-fast)]',
                !group.collapsed && 'rotate-90',
              )}
            />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.hex }} />
            {editing ? (
              <input
                ref={inputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitName();
                  else if (event.key === 'Escape') {
                    setName(group.name);
                    setEditing(false);
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                className="min-w-0 flex-1 rounded bg-surface px-1 text-text outline-none"
              />
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-left"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setEditing(true);
                }}
              >
                {group.name || 'Group'}
              </span>
            )}
          </button>
          <span className="shrink-0 text-faint tabular-nums">{count}</span>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menuContentClass}>
          <ContextMenu.Item className={menuItemClass} onSelect={() => setEditing(true)}>
            Rename group
          </ContextMenu.Item>
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className={menuItemClass}>Colour…</ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className={menuContentClass} sideOffset={4}>
                {TAB_GROUP_COLOR_ORDER.map((key) => (
                  <ContextMenu.Item
                    key={key}
                    className={menuItemClass}
                    onSelect={() =>
                      void trpc.tabs.updateGroup.mutate({ groupId: group.id, color: key })
                    }
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: TAB_GROUP_COLORS[key].hex }}
                    />
                    {TAB_GROUP_COLORS[key].label}
                  </ContextMenu.Item>
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          <ContextMenu.Separator className={menuSeparatorClass} />
          <ContextMenu.Item
            className={menuItemClass}
            onSelect={() => void trpc.tabs.removeGroup.mutate({ groupId: group.id })}
          >
            Ungroup tabs
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemClass} onSelect={onCloseGroup}>
            Close group
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
