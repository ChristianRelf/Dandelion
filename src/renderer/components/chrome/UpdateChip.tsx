import { useState, type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ArrowUpCircle, ExternalLink } from 'lucide-react';
import { formatBytes, formatRelativeTime, formatSpeed } from '@shared/utils';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { trpc } from '../../lib/trpc/client';
import { openUrlOrToast } from '../../lib/navigation';
import { selectChipStatus, useUpdateStore } from '../../stores/update.store';
import { toast } from '../../stores/toast.store';

const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The download filling up, drawn as a ring around the toolbar slot the ready
 * arrow will occupy — so the chip grows into its final state rather than
 * swapping for a different control.
 */
function ProgressRing({ percent }: { percent: number }): ReactElement {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-[18px] w-[18px] -rotate-90">
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="2"
        className="stroke-surface-active"
      />
      <circle
        cx="10"
        cy="10"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
        className="stroke-accent transition-[stroke-dashoffset] duration-[var(--duration-base)] ease-[var(--ease-out)]"
      />
    </svg>
  );
}

/**
 * Appears in the toolbar while a new version is downloading, and stays once it
 * is waiting. Updates are never applied underneath an active session, so the
 * ready state is the moment the user chooses to restart into one. Dismissing
 * hides it for this run; the update stays on disk and the About page can still
 * install it.
 *
 * Checking and failures are deliberately absent — see `selectChipStatus`.
 */
export function UpdateChip(): ReactElement | null {
  const status = useUpdateStore(selectChipStatus);
  const dismiss = useUpdateStore((state) => state.dismiss);
  const [open, setOpen] = useState(false);

  if (!status) return null;

  const restart = (): void => {
    void trpc.app.installUpdate.mutate().catch(() => {
      setOpen(false);
      toast.error('Could not install the update', {
        description: 'Restart Dandelion to try again.',
      });
    });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip
        content={
          status.phase === 'downloading'
            ? `Downloading ${status.version}`
            : `Version ${status.version} is ready`
        }
      >
        <Popover.Trigger asChild>
          <IconButton
            aria-label={
              status.phase === 'downloading'
                ? `Downloading version ${status.version} — ${status.percent}%`
                : `Update to version ${status.version}`
            }
            active={open}
          >
            {status.phase === 'downloading' ? (
              <ProgressRing percent={status.percent} />
            ) : (
              <ArrowUpCircle className="h-[18px] w-[18px] text-accent" />
            )}
          </IconButton>
        </Popover.Trigger>
      </Tooltip>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[80] w-[280px] animate-pop rounded-xl border border-line p-3 shadow-[var(--shadow-lg)] glass-strong"
        >
          {status.phase === 'downloading' ? (
            <>
              <p className="text-[13px] font-medium text-text">Downloading update</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Dandelion {status.version} is downloading in the background. You&apos;ll be able to
                restart into it once it&apos;s ready.
              </p>
              <div
                className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-active"
                role="progressbar"
                aria-valuenow={status.total > 0 ? status.percent : undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Version ${status.version} download progress`}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-[var(--duration-fast)]"
                  style={{ width: status.total > 0 ? `${status.percent}%` : '100%' }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-faint">
                {status.total > 0
                  ? `${formatBytes(status.transferred)} of ${formatBytes(status.total)}`
                  : formatBytes(status.transferred)}
                {status.bytesPerSecond > 0 && ` · ${formatSpeed(status.bytesPerSecond)}`}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-medium text-text">Update ready</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                Dandelion {status.version} has been downloaded. It will be applied when you restart
                — your open tabs are restored.
              </p>
              {status.releasedAt !== null && (
                <p className="mt-1 text-[11px] text-faint">
                  Released {formatRelativeTime(status.releasedAt)}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openUrlOrToast(status.releaseUrl, 'Could not open the release notes');
                }}
                className="mt-2 inline-flex items-center gap-1 rounded-xs text-[12px] text-accent transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                What&apos;s new
                <ExternalLink className="h-3 w-3" />
              </button>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="primary" onClick={restart}>
                  Restart now
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    dismiss();
                  }}
                >
                  Later
                </Button>
              </div>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
