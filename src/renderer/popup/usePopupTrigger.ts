import { useCallback, useEffect, useRef, useState } from 'react';
import type { PopupKind } from '@shared/types';
import { trpc } from '../lib/trpc/client';
import { onBrowserEventOf } from '../lib/events';

interface PopupTrigger<T extends HTMLElement> {
  /** Put this on the trigger: its rectangle is what the popover anchors to. */
  ref: React.RefObject<T | null>;
  open: boolean;
  toggle: () => void;
}

/**
 * Drives a toolbar button that opens its popover in the floating popup surface.
 *
 * The popover cannot live in the chrome: tab content is a native view stacked
 * above it, so anything dropping into the content region is painted over and
 * cannot be clicked. The chrome keeps the button and hands main the rectangle to
 * anchor to; `PopupHost` renders the body in a surface above the page.
 *
 * `open` comes back from main rather than being tracked here, because main is
 * what actually decides: the surface also closes on blur, which the button would
 * never hear about and would then draw itself active over a closed popover.
 */
export function usePopupTrigger<T extends HTMLElement>(kind: PopupKind): PopupTrigger<T> {
  const ref = useRef<T>(null);
  const [open, setOpen] = useState(false);
  const windowId = window.dandelion.windowId;

  useEffect(
    () =>
      onBrowserEventOf('popup:show', (event) => {
        if (event.windowId === windowId) setOpen(event.kind === kind);
      }),
    [kind, windowId],
  );

  const toggle = useCallback(() => {
    if (open) {
      void trpc.popup.close.mutate();
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    void trpc.popup.open.mutate({
      kind,
      anchor: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  }, [kind, open]);

  return { ref, open, toggle };
}
