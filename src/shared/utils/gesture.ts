export interface GesturePoint {
  x: number;
  y: number;
}

/**
 * How far the pointer must travel before a segment counts, in px.
 *
 * This is what keeps a plain right-click from being read as a gesture: a click
 * carries a pixel or two of jitter, and everything under the threshold reduces
 * to the empty stroke, which matches no binding.
 */
export const GESTURE_SEGMENT_PX = 28;

/**
 * Longest stroke worth reading. Every binding is one or two segments, so a
 * longer path is a scribble, not an instruction — stopping early also bounds
 * the work done on a drag across the whole screen.
 */
export const GESTURE_MAX_SEGMENTS = 4;

/**
 * Reduce a pointer path to cardinal segments, e.g. `L`, `DR`, `UD`.
 *
 * The path is walked with a moving anchor: each time the pointer gets
 * {@link GESTURE_SEGMENT_PX} from the anchor, the dominant axis of that move
 * becomes a segment and the anchor jumps forward. Consecutive repeats collapse,
 * so a long left drag is `L` rather than `LLLL`, and only a real change of
 * direction adds a segment.
 *
 * Returns `''` for anything too short to be deliberate.
 */
export function recognizeGesture(
  points: readonly GesturePoint[],
  minSegment: number = GESTURE_SEGMENT_PX,
): string {
  let anchor = points[0];
  if (!anchor) return '';

  const segments: string[] = [];
  for (const point of points) {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    if (Math.abs(dx) < minSegment && Math.abs(dy) < minSegment) continue;

    const direction =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U';
    if (segments[segments.length - 1] !== direction) segments.push(direction);
    anchor = point;
    if (segments.length >= GESTURE_MAX_SEGMENTS) break;
  }
  return segments.join('');
}

const ARROWS: Record<string, string> = { L: '←', R: '→', U: '↑', D: '↓' };

/** A stroke rendered as arrows for display, e.g. `DR` → `↓→`. */
export function gestureLabel(gesture: string): string {
  return [...gesture].map((segment) => ARROWS[segment] ?? segment).join('');
}
