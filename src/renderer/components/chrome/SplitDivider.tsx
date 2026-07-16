import { useRef, type PointerEvent, type KeyboardEvent, type ReactElement } from 'react';
import {
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  SPLIT_GAP,
} from '@shared/utils';
import { cn } from '../../lib/cn';
import { trpc } from '../../lib/trpc/client';
import {
  selectSplitActive,
  selectSplitOrientation,
  selectSplitRatio,
  useBrowserStore,
} from '../../stores/browser.store';

/** How far one arrow-key press moves the divider. */
const KEY_STEP = 0.02;

/**
 * The draggable divider between split panes.
 *
 * It sits in the {@link SPLIT_GAP} the main process leaves between panes —
 * chrome renders *beneath* the native content views, so the gap is the only
 * place a divider can be seen or clicked at all.
 *
 * The same property bounds the drag: while the pointer is over a pane, this
 * window receives no pointer events. In practice the gap follows the pointer,
 * because each move relays out the panes around the new ratio, so the pointer
 * has to outrun the divider within a single frame to lose it — and it is picked
 * straight back up on the next move over the gap.
 */
export function SplitDivider(): ReactElement | null {
  const active = useBrowserStore(selectSplitActive);
  const orientation = useBrowserStore(selectSplitOrientation);
  const ratio = useBrowserStore(selectSplitRatio);
  const windowId = useBrowserStore((state) => state.windowId);
  const paneCount = useBrowserStore((state) => state.windowState?.splitTabIds.length ?? 0);
  const ref = useRef<HTMLDivElement>(null);

  // A ratio only describes two panes; more are always divided evenly.
  if (!active || paneCount !== 2) return null;

  const vertical = orientation === 'vertical';

  const apply = (next: number): void => {
    void trpc.tabs.setSplitRatio.mutate({ windowId, ratio: clampSplitRatio(next) });
  };

  const ratioAt = (event: PointerEvent<HTMLDivElement>): number | null => {
    const track = ref.current?.parentElement;
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    const size = vertical ? rect.width : rect.height;
    if (size <= 0) return null;
    const offset = vertical ? event.clientX - rect.left : event.clientY - rect.top;
    return offset / size;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // The button can be released over a pane, where this window sees no events
    // at all — so the button state on the next move it *does* see is the only
    // signal the drag is over. Without this the divider would jump to the
    // pointer the next time it crossed the gap, with nothing held down.
    if (event.buttons === 0) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const next = ratioAt(event);
    if (next !== null) apply(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const back = vertical ? 'ArrowLeft' : 'ArrowUp';
    const forward = vertical ? 'ArrowRight' : 'ArrowDown';
    if (event.key === back) apply(ratio - KEY_STEP);
    else if (event.key === forward) apply(ratio + KEY_STEP);
    else if (event.key === 'Home') apply(MIN_SPLIT_RATIO);
    else if (event.key === 'End') apply(MAX_SPLIT_RATIO);
    else if (event.key === 'Enter') apply(DEFAULT_SPLIT_RATIO);
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={ref}
      role="separator"
      tabIndex={0}
      aria-label="Resize split panes"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={Math.round(MIN_SPLIT_RATIO * 100)}
      aria-valuemax={Math.round(MAX_SPLIT_RATIO * 100)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={() => apply(DEFAULT_SPLIT_RATIO)}
      title="Drag to resize · double-click to even out"
      className={cn(
        'group absolute z-10 flex items-center justify-center',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        vertical ? 'top-0 bottom-0 cursor-col-resize' : 'right-0 left-0 cursor-row-resize',
      )}
      style={
        vertical
          ? { left: `calc(${ratio * 100}% - ${SPLIT_GAP / 2}px)`, width: SPLIT_GAP }
          : { top: `calc(${ratio * 100}% - ${SPLIT_GAP / 2}px)`, height: SPLIT_GAP }
      }
    >
      {/* The grab handle: a hairline that thickens under the pointer. */}
      <span
        className={cn(
          'rounded-full bg-line transition-colors duration-[var(--duration-fast)]',
          'group-hover:bg-accent group-focus-visible:bg-accent',
          vertical ? 'h-8 w-[3px]' : 'h-[3px] w-8',
        )}
      />
    </div>
  );
}
