import type { ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

/**
 * A focused confirmation modal for consequential actions (clear history, delete
 * a password). Radix provides the focus trap, escape handling and scrim.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps): ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <Dialog.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed top-1/2 left-1/2 z-[101] w-[400px] max-w-[92vw] animate-pop -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line p-5 shadow-[var(--shadow-lg)] glass-strong"
        >
          <Dialog.Title className="text-[15px] font-semibold text-text">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1.5 text-[13px] leading-relaxed text-muted">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              size="sm"
              autoFocus
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
