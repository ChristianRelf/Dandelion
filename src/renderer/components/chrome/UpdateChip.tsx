import { useState, type ReactElement } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ArrowUpCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { trpc } from '../../lib/trpc/client';
import { selectUpdateReady, useUpdateStore } from '../../stores/update.store';
import { toast } from '../../stores/toast.store';

/**
 * Appears in the toolbar once a new version has been downloaded and is waiting.
 * Updates are never applied underneath an active session, so this is the moment
 * the user chooses to restart into one. Dismissing hides it for this run; the
 * update stays on disk and the About page can still install it.
 */
export function UpdateChip(): ReactElement | null {
  const ready = useUpdateStore(selectUpdateReady);
  const version = useUpdateStore((state) => state.readyVersion);
  const dismiss = useUpdateStore((state) => state.dismiss);
  const [open, setOpen] = useState(false);

  if (!ready || !version) return null;

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
      <Tooltip content={`Version ${version} is ready`}>
        <Popover.Trigger asChild>
          <IconButton aria-label={`Update to version ${version}`} active={open}>
            <ArrowUpCircle className="h-[18px] w-[18px] text-accent" />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[80] w-[280px] animate-pop rounded-xl border border-line p-3 shadow-[var(--shadow-lg)] glass-strong"
        >
          <p className="text-[13px] font-medium text-text">Update ready</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Dandelion {version} has been downloaded. It will be applied when you restart — your open
            tabs are restored.
          </p>
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
