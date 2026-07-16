import { useEffect, useState, type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Minus, Plus, RotateCcw, Search } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { trpc } from '../../lib/trpc/client';
import { dispatchCommand } from '../../lib/commands';
import { useBrowserStore } from '../../stores/browser.store';

/** Per-site zoom control. Chromium persists the level per host within the session. */
export function ZoomControl(): ReactElement {
  const tabId = useBrowserStore((state) => state.activeTabId);
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(100);

  const refresh = (): void => {
    if (tabId) void trpc.tabs.getZoom.query({ tabId }).then(setPercent).catch(() => undefined);
  };

  useEffect(() => {
    if (open) refresh();
  }, [open, tabId]);

  const step = (command: string): void => {
    dispatchCommand(command);
    setTimeout(refresh, 90);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip content="Zoom">
        <Popover.Trigger asChild>
          <IconButton aria-label="Zoom" active={open}>
            <Search className="h-[18px] w-[18px]" />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="animate-pop z-[80] flex items-center gap-1 rounded-xl border border-line p-1 shadow-[var(--shadow-lg)] glass-strong"
        >
          <IconButton size="sm" onClick={() => step('view.zoomOut')} aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={() => step('view.zoomReset')}
            aria-label="Reset zoom"
            className="min-w-16 rounded-md px-1 py-1 text-center text-[13px] text-text tabular-nums transition-colors hover:bg-surface-hover"
          >
            {percent}%
          </button>
          <IconButton size="sm" onClick={() => step('view.zoomIn')} aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </IconButton>
          <IconButton size="sm" onClick={() => step('view.zoomReset')} aria-label="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </IconButton>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
