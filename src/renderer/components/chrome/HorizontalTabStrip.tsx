import type { KeyboardEvent, ReactElement } from 'react';
import { Plus, X } from 'lucide-react';
import type { Tab } from '@shared/types';
import { prettifyUrl } from '@shared/utils';
import { INTERNAL_PAGES } from '@shared/constants';
import { cn } from '../../lib/cn';
import { Favicon } from '../ui/Favicon';
import { Spinner } from '../ui/Spinner';
import { IconButton } from '../ui/IconButton';
import { trpc } from '../../lib/trpc/client';
import { useBrowserStore } from '../../stores/browser.store';
import { useOrderedTabs } from '../../hooks/useBrowser';
import { TabContextMenu } from './TabContextMenu';

function StripTab({ tab, active }: { tab: Tab; active: boolean }): ReactElement {
  const label = tab.title || (tab.url === INTERNAL_PAGES.newTab ? 'New Tab' : prettifyUrl(tab.url));
  const activate = (): void => void trpc.tabs.activate.mutate({ tabId: tab.id });

  return (
    <TabContextMenu tab={tab}>
      <div
        role="tab"
        aria-selected={active}
        tabIndex={0}
        title={label}
        onClick={activate}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        }}
        onAuxClick={(event) => {
          if (event.button === 1) void trpc.tabs.close.mutate({ tabId: tab.id });
        }}
        className={cn(
          'group flex h-7 max-w-[220px] min-w-[44px] flex-1 shrink cursor-default items-center gap-2 rounded-lg px-2 text-[13px] no-drag',
          'transition-[background-color,color] duration-[var(--duration-fast)]',
          active
            ? 'bg-surface-active text-text shadow-[var(--shadow-sm)]'
            : 'text-muted hover:bg-surface-hover hover:text-text',
        )}
      >
        {tab.status === 'loading' ? (
          <Spinner size={14} className="shrink-0 text-accent" />
        ) : (
          <Favicon src={tab.favicon} className="h-4 w-4 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void trpc.tabs.close.mutate({ tabId: tab.id });
          }}
          className="shrink-0 rounded-md p-0.5 text-faint opacity-0 transition-[opacity,background-color,color] group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-active hover:text-text focus-visible:opacity-100"
          aria-label={`Close ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </TabContextMenu>
  );
}

/** Chrome-style horizontal tab strip (alternative to the vertical sidebar). */
export function HorizontalTabStrip(): ReactElement {
  const tabs = useOrderedTabs();
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const activeWorkspaceId = useBrowserStore((state) => state.activeWorkspaceId);

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 px-2 drag">
      <div
        role="tablist"
        aria-label="Tabs"
        className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => (
          <StripTab key={tab.id} tab={tab} active={tab.id === activeTabId} />
        ))}
      </div>
      <IconButton
        size="sm"
        onClick={() =>
          activeWorkspaceId &&
          void trpc.tabs.create.mutate({ workspaceId: activeWorkspaceId, active: true })
        }
        aria-label="New tab"
      >
        <Plus className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
