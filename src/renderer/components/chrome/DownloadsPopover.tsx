import { useEffect, type ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Download as DownloadIcon } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { trpc } from '../../lib/trpc/client';
import { onBrowserEventOf } from '../../lib/events';
import { dispatchCommand } from '../../lib/commands';
import { useDownloadsStore, selectActiveDownloadCount } from '../../stores/downloads.store';
import { usePopupTrigger } from '../../popup/usePopupTrigger';
import { DownloadRow } from './DownloadRow';

/** The most recent downloads, newest first — enough to be useful, not a page. */
const VISIBLE_LIMIT = 5;

/** The download bubble's contents, rendered in the floating popup surface. */
export function DownloadsPopoverBody(): ReactElement {
  const recent = useDownloadsStore(
    useShallow((state) =>
      Object.values(state.downloads)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, VISIBLE_LIMIT),
    ),
  );

  return (
    <div className="w-[340px] p-1.5">
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">
          Downloads
        </span>
        <button
          type="button"
          className="rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
          onClick={() => {
            void trpc.popup.close.mutate();
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
    </div>
  );
}

/**
 * The toolbar's download button. Opens on click, and pops itself open when a
 * download starts so progress is visible without leaving the page — which is
 * exactly why the bubble floats above the page rather than hiding it: a download
 * begins from a click on the page you are reading, and yanking it away to
 * announce that would be a strange way to say "this is going fine".
 *
 * It listens for `download:created` itself rather than being told to open by the
 * provider, because opening needs this button's rectangle to anchor to and only
 * this component has it.
 */
export function DownloadsPopover(): ReactElement {
  const activeCount = useDownloadsStore(selectActiveDownloadCount);
  const { ref, open, toggle } = usePopupTrigger<HTMLButtonElement>('downloads');

  useEffect(
    () =>
      onBrowserEventOf('download:created', () => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        void trpc.popup.open.mutate({
          kind: 'downloads',
          anchor: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        });
      }),
    [ref],
  );

  return (
    <Tooltip content="Downloads" shortcut="⌘⇧J">
      <IconButton
        ref={ref}
        aria-label={activeCount > 0 ? `Downloads, ${activeCount} active` : 'Downloads'}
        aria-expanded={open}
        active={open}
        onClick={toggle}
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
    </Tooltip>
  );
}
