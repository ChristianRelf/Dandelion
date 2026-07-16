import type { SplitOrientation, WindowBounds } from '../types';

/**
 * Space left between panes. The divider is chrome, and chrome renders *under*
 * the native content views — so the only place it can be seen or clicked is a
 * gap where no pane is laid out. This is that gap.
 */
export const SPLIT_GAP = 8;

/** Neither pane may be squeezed below this share of the content area. */
export const MIN_SPLIT_RATIO = 0.15;
export const MAX_SPLIT_RATIO = 0.85;

export const DEFAULT_SPLIT_RATIO = 0.5;

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT_RATIO;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio));
}

/**
 * Where each pane sits inside `bounds`, with {@link SPLIT_GAP} between them.
 *
 * Two panes divide by `ratio`; any other number divides evenly, because a
 * single ratio cannot describe three or more panes and the UI only ever splits
 * two. Rounded to whole pixels so panes never leave a subpixel seam.
 */
export function splitPaneBounds(
  bounds: WindowBounds,
  count: number,
  orientation: SplitOrientation,
  ratio: number,
): WindowBounds[] {
  if (count < 1) return [];

  const vertical = orientation === 'vertical';
  const total = vertical ? bounds.width : bounds.height;
  const gaps = SPLIT_GAP * (count - 1);
  const usable = Math.max(0, total - gaps);

  // Fraction of the usable space each pane gets, in order.
  const shares =
    count === 2
      ? [clampSplitRatio(ratio), 1 - clampSplitRatio(ratio)]
      : Array.from({ length: count }, () => 1 / count);

  const rects: WindowBounds[] = [];
  // `offset` walks the axis and so includes the gaps; `used` counts pane pixels
  // only, because `usable` has already had the gaps taken out of it.
  let offset = 0;
  let used = 0;
  for (let index = 0; index < count; index += 1) {
    // The last pane takes the remainder, so rounding can never leave a seam.
    const size = index === count - 1 ? usable - used : Math.round(usable * (shares[index] ?? 0));
    rects.push(
      vertical
        ? {
            x: Math.round(bounds.x + offset),
            y: Math.round(bounds.y),
            width: Math.round(size),
            height: Math.round(bounds.height),
          }
        : {
            x: Math.round(bounds.x),
            y: Math.round(bounds.y + offset),
            width: Math.round(bounds.width),
            height: Math.round(size),
          },
    );
    offset += size + SPLIT_GAP;
    used += size;
  }
  return rects;
}
