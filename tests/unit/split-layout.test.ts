import { describe, expect, it } from 'vitest';
import {
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  SPLIT_GAP,
  splitPaneBounds,
} from '@shared/utils';

/** A content area with a deliberately non-zero origin, to catch offset bugs. */
const BOUNDS = { x: 100, y: 50, width: 1000, height: 600 };

describe('clampSplitRatio', () => {
  it('keeps a ratio inside the range', () => {
    expect(clampSplitRatio(0.5)).toBe(0.5);
    expect(clampSplitRatio(0.25)).toBe(0.25);
  });

  it('clamps a pane that would be squeezed away', () => {
    expect(clampSplitRatio(0)).toBe(MIN_SPLIT_RATIO);
    expect(clampSplitRatio(1)).toBe(MAX_SPLIT_RATIO);
    expect(clampSplitRatio(-5)).toBe(MIN_SPLIT_RATIO);
    expect(clampSplitRatio(5)).toBe(MAX_SPLIT_RATIO);
  });

  it('falls back to an even split for a value that is not a number', () => {
    expect(clampSplitRatio(Number.NaN)).toBe(DEFAULT_SPLIT_RATIO);
    expect(clampSplitRatio(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SPLIT_RATIO);
  });
});

describe('splitPaneBounds', () => {
  it('leaves exactly one gap between two vertical panes, and no seam', () => {
    const [left, right] = splitPaneBounds(BOUNDS, 2, 'vertical', 0.5);

    expect(left!.x).toBe(BOUNDS.x);
    expect(right!.x - (left!.x + left!.width)).toBe(SPLIT_GAP);
    // The panes plus the gap fill the area exactly — no leftover strip.
    expect(right!.x + right!.width).toBe(BOUNDS.x + BOUNDS.width);
  });

  it('honours the ratio', () => {
    const [left, right] = splitPaneBounds(BOUNDS, 2, 'vertical', 0.3);
    const usable = BOUNDS.width - SPLIT_GAP;

    expect(left!.width).toBe(Math.round(usable * 0.3));
    expect(left!.width + right!.width).toBe(usable);
  });

  it('splits along the other axis when horizontal', () => {
    const [top, bottom] = splitPaneBounds(BOUNDS, 2, 'horizontal', 0.25);
    const usable = BOUNDS.height - SPLIT_GAP;

    expect(top!.height).toBe(Math.round(usable * 0.25));
    expect(top!.width).toBe(BOUNDS.width);
    expect(bottom!.y - (top!.y + top!.height)).toBe(SPLIT_GAP);
    expect(bottom!.y + bottom!.height).toBe(BOUNDS.y + BOUNDS.height);
  });

  it('clamps a ratio that would collapse a pane', () => {
    const [left, right] = splitPaneBounds(BOUNDS, 2, 'vertical', 0.99);
    expect(right!.width).toBeGreaterThan(0);
    expect(left!.width).toBe(Math.round((BOUNDS.width - SPLIT_GAP) * MAX_SPLIT_RATIO));
  });

  it('ignores the ratio for more than two panes and divides evenly', () => {
    const rects = splitPaneBounds(BOUNDS, 3, 'vertical', 0.9);
    const widths = rects.map((rect) => rect.width);

    // Even, give or take the remainder the last pane absorbs.
    for (const width of widths) expect(Math.abs(width - widths[0]!)).toBeLessThanOrEqual(1);
    expect(rects[2]!.x + rects[2]!.width).toBe(BOUNDS.x + BOUNDS.width);
  });

  it('never overlaps panes, whatever the ratio', () => {
    for (const ratio of [MIN_SPLIT_RATIO, 0.33, DEFAULT_SPLIT_RATIO, 0.77, MAX_SPLIT_RATIO]) {
      const [left, right] = splitPaneBounds(BOUNDS, 2, 'vertical', ratio);
      expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
    }
  });

  it('returns nothing when there is nothing to lay out', () => {
    expect(splitPaneBounds(BOUNDS, 0, 'vertical', 0.5)).toEqual([]);
  });
});
