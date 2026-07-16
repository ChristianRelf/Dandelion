import { type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useShallow } from 'zustand/react/shallow';
import { Download as DownloadIcon, Folder, Pause, Play, ShieldAlert, X } from 'lucide-react';
import type { Download } from '@shared/types';
import { cn } from '../../lib/cn';
import { describe, fileIconName, isActive, progressOf } from '../../lib/downloads';
import { IconButton } from '../ui/IconButton';
import { IconTile } from '../ui/IconTile';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';
import { trpc } from '../../lib/trpc/client';
import { dispatchCommand } from '../../lib/commands';
import { useDownloadsStore, selectActiveDownloadCount } from '../../stores/downloads.store';
import { useUiStore } from '../../stores/ui.store';
import { toast } from '../../stores/toast.store';

/** The most recent downloads, newest first — enough to be useful, not a page. */
const VISIBLE_LIMIT = 5;

function PopoverRow({ download }: { download: Download }): ReactElement {
  const { id } = download;
  const active = isActive(download);
  const malicious = download.safety === 'malicious';
  const percent = Math.round(progressOf(download) * 100);

  const act = (call: Promise<unknown>, failure: string): void =>
    void call.catch(() => toast.error(failure));

  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hover">
      <IconTile size="sm">
        {malicious ? (
          <ShieldAlert className="h-4 w-4 text-danger" />
        ) : (
          <Icon name={fileIconName(download)} className="h-4 w-4" />
        )}
      </IconTile>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-text" title={download.filename}>
          {download.filename}
        </p>
        <p
          className={cn(
            'truncate text-[11px]',
            download.state === 'interrupted' ? 'text-danger' : 'text-faint',
          )}
        >
          {describe(download)}
        </p>

        {active && (
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-active"
            role="progressbar"
            aria-valuenow={download.totalBytes > 0 ? percent : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${download.filename} progress`}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[var(--duration-fast)]"
              style={{ width: download.totalBytes > 0 ? `${percent}%` : '100%' }}
            />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {active && (
          <>
            <IconButton
              size="sm"
              aria-label={
                download.paused ? `Resume ${download.filename}` : `Pause ${download.filename}`
              }
              disabled={download.paused && !download.canResume}
              onClick={() =>
                act(
                  download.paused
                    ? trpc.downloads.resume.mutate({ downloadId: id })
                    : trpc.downloads.pause.mutate({ downloadId: id }),
                  download.paused ? 'Could not resume download' : 'Could not pause download',
                )
              }
            >
              {download.paused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </IconButton>
            <IconButton
              size="sm"
              aria-label={`Cancel ${download.filename}`}
              onClick={() =>
                act(trpc.downloads.cancel.mutate({ downloadId: id }), 'Could not cancel download')
              }
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </>
        )}
        {download.state === 'completed' && !malicious && (
          <IconButton
            size="sm"
            aria-label={`Show ${download.filename} in folder`}
            onClick={() =>
              act(trpc.downloads.showInFolder.mutate({ downloadId: id }), 'Could not reveal file')
            }
          >
            <Folder className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

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
                <PopoverRow key={download.id} download={download} />
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
