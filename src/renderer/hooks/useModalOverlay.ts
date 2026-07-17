import { useEffect, useRef, type RefObject } from 'react';

/**
 * Modal keyboard behaviour for the chrome's hand-rolled overlays — the command
 * palette and the tab switcher, which wrap cmdk rather than a Radix dialog and
 * so inherit none of its focus management.
 *
 * cmdk binds ArrowDown/ArrowUp/Enter and nothing else, and a `fixed inset-0`
 * scrim blocks the pointer but not the tab order: without this, Tab walks
 * straight out of the overlay into the chrome behind it.
 *
 * Returns the ref to attach to the overlay's search field, which this hook
 * focuses itself — see below.
 */
export function useModalOverlay(
  open: boolean,
  close: () => void,
): RefObject<HTMLInputElement | null> {
  const field = useRef<HTMLInputElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
      return;
    }
    // Recorded before the field is focused, and deliberately not left to
    // `autoFocus`: React applies that during the very commit that opens the
    // overlay, before any effect here runs, so the element it displaced would
    // already be lost. Refs are attached before passive effects, so the field is
    // focused synchronously — a deferred focus can drop a fast first keystroke.
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    field.current?.focus();
  }, [open]);

  /**
   * Bound on the window rather than on the overlay's own element. A bubbling
   * handler only sees keys while focus is inside the overlay, which is exactly
   * the assumption that failed: once Tab had moved focus to the toolbar, Escape
   * went to the toolbar too and the palette could not be closed by keyboard.
   */
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
      else if (event.key === 'Tab') event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return field;
}
