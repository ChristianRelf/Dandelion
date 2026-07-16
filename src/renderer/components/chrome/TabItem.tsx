import { useEffect, useRef, type DragEvent, type KeyboardEvent, type ReactElement } from 'react';
import { Pin, Volume2, VolumeX, X } from 'lucide-react';
import type { Tab } from '@shared/types';
import { prettifyUrl } from '@shared/utils';
import { INTERNAL_PAGES } from '@shared/constants';
import { cn } from '../../lib/cn';
import { Favicon } from '../ui/Favicon';
import { Spinner } from '../ui/Spinner';
import { trpc } from '../../lib/trpc/client';
import { useTabPreviewStore } from '../../stores/tab-preview.store';
import { TabContextMenu } from './TabContextMenu';

interface TabItemProps {
  tab: Tab;
  active: boolean;
  /** Hex accent shown as a left rail when the tab belongs to a group. */
  groupColor?: string;
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDragEnter?: (event: DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (event: DragEvent) => void;
  /** Show an insertion line above this row while dragging. */
  dropBefore?: boolean;
  dragging?: boolean;
}

export function TabItem({
  tab,
  active,
  groupColor,
  draggable = false,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  dropBefore = false,
  dragging = false,
}: TabItemProps): ReactElement {
  const isNewTab = tab.url === INTERNAL_PAGES.newTab;
  const label = tab.title || (isNewTab ? 'New Tab' : prettifyUrl(tab.url));
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(hoverTimer.current);
      useTabPreviewStore.getState().hide(tab.id);
    },
    [tab.id],
  );

  const activate = (): void => void trpc.tabs.activate.mutate({ tabId: tab.id });
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };

  return (
    <TabContextMenu tab={tab}>
      <div
        role="tab"
        aria-selected={active}
        tabIndex={0}
        title={label}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragOver={(event) => draggable && event.preventDefault()}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
        onClick={activate}
        onKeyDown={onKeyDown}
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => {
            useTabPreviewStore.getState().show(tab.id, {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            });
          }, 450);
        }}
        onMouseLeave={() => {
          clearTimeout(hoverTimer.current);
          useTabPreviewStore.getState().hide(tab.id);
        }}
        onAuxClick={(event) => {
          if (event.button === 1) void trpc.tabs.close.mutate({ tabId: tab.id });
        }}
        className={cn(
          'group relative flex h-[34px] cursor-default items-center gap-2 rounded-lg pr-1.5 pl-2 text-[13px]',
          'transition-[background-color,color,opacity] duration-[var(--duration-fast)]',
          active
            ? 'bg-surface-active text-text shadow-[var(--shadow-sm)]'
            : 'text-muted hover:bg-surface-hover hover:text-text',
          dragging && 'opacity-40',
        )}
      >
        {dropBefore && (
          <span className="pointer-events-none absolute -top-[3px] right-1 left-1 h-0.5 rounded-full bg-accent" />
        )}
        {groupColor && (
          <span
            className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full"
            style={{ backgroundColor: groupColor }}
          />
        )}

        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {tab.status === 'loading' ? (
            <Spinner size={14} className="text-accent" />
          ) : (
            <Favicon src={tab.favicon} className={cn('h-4 w-4', tab.asleep && 'opacity-50')} />
          )}
        </span>

        <span className={cn('min-w-0 flex-1 truncate', tab.asleep && 'opacity-60')}>{label}</span>

        {tab.pinned && <Pin className="h-3 w-3 shrink-0 text-faint" />}

        {(tab.audible || tab.muted) && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void trpc.tabs.setMuted.mutate({ tabId: tab.id, muted: !tab.muted });
            }}
            className="shrink-0 rounded-md p-0.5 text-faint transition-colors hover:bg-surface-active hover:text-text"
            aria-label={tab.muted ? 'Unmute tab' : 'Mute tab'}
          >
            {tab.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void trpc.tabs.close.mutate({ tabId: tab.id });
          }}
          className={cn(
            'shrink-0 rounded-md p-0.5 text-faint transition-[opacity,background-color,color]',
            'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-surface-active hover:text-text focus-visible:opacity-100',
            active && 'opacity-100',
          )}
          aria-label={`Close ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </TabContextMenu>
  );
}
