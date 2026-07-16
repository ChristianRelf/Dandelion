import { type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useShallow } from 'zustand/react/shallow';
import { Download as DownloadIcon } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { dispatchCommand } from '../../lib/commands';
import { useDownloadsStore, selectActiveDownloadCount } from '../../stores/downloads.store';
import { useUiStore } from '../../stores/ui.store';
import { DownloadRow } from './DownloadRow';

/** The most recent downloads, newest first — enough to be useful, not a page. */
const VISIBLE_LIMIT = 5;

/**
 * The toolbar's download bubble. Opens on click, and pops itself open when a
 * download starts so progress is visible without leaving the page.
 */
export function DownloadsPopover(): ReactElement {
  const open = useUiStore((state) => state.downloadsPopoverOpen);
  const setOpen = useUiStore((state) => state.setDownloadsPopoverOpen);
  const activeCount = useDownloadsStore(selectActiveDownloadCount);

  const recent = useDownloadsStore(
    useShallow((state) =>
      Object.values(state.downloads)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, VISIBLE_LIMIT),
    ),
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip content="Downloads" shortcut="⌘⇧J">
        <Popover.Trigger asChild>
          <IconButton
            aria-label={activeCount > 0 ? `Downloads, ${activeCount} active` : 'Downloads'}
            active={open}
            className="relative"
          >
            <DownloadIcon className="h-[18px] w-[18px]" />
            {activeCount > 0 && (
              <span
                aria-live="polite"
                className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-fg tabular-nums"
              >
                {activeCount}
              </span>
            )}
          </IconButton>
        </Popover.Trigger>
      </Tooltip>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[80] w-[340px] animate-pop rounded-xl border border-line p-1.5 shadow-[var(--shadow-lg)] glass-strong"
        >
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">
              Downloads
            </span>
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
              onClick={() => {
                setOpen(false);
                dispatchCommand('tools.downloads');
              }}
            >
              See all
            </button>
          </div>

          {recent.length === 0 ? (
            <p className="px-2 py-6 text-center text-[12px] text-faint">No downloads yet</p>
          ) : (
            <div className="space-y-0.5">
              {recent.map((download) => (
                <DownloadRow key={download.id} download={download} />
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
