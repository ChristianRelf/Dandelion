import { describe, expect, it } from 'vitest';

import {
  gestureLabel,
  recognizeGesture,
  GESTURE_MAX_SEGMENTS,
  GESTURE_SEGMENT_PX,
  type GesturePoint,
} from '@shared/utils';
import { DEFAULT_GESTURES } from '@shared/constants';
import { getCommand } from '@shared/constants';

/** A straight drag from (0,0) by `dx`/`dy`, sampled like a real mouse would. */
function drag(dx: number, dy: number, from: GesturePoint = { x: 0, y: 0 }): GesturePoint[] {
  const steps = 20;
  return Array.from({ length: steps + 1 }, (_, i) => ({
    x: from.x + (dx * i) / steps,
    y: from.y + (dy * i) / steps,
  }));
}

const path = (...legs: GesturePoint[][]): GesturePoint[] => legs.flat();

describe('recognizeGesture', () => {
  it('reads the four cardinal strokes', () => {
    expect(recognizeGesture(drag(-200, 0))).toBe('L');
    expect(recognizeGesture(drag(200, 0))).toBe('R');
    expect(recognizeGesture(drag(0, -200))).toBe('U');
    expect(recognizeGesture(drag(0, 200))).toBe('D');
  });

  it('collapses a long drag to one segment', () => {
    expect(recognizeGesture(drag(-1000, 0))).toBe('L');
  });

  it('reads a two-segment stroke', () => {
    expect(recognizeGesture(path(drag(0, 200), drag(200, 0, { x: 0, y: 200 })))).toBe('DR');
    expect(recognizeGesture(path(drag(0, 200), drag(-200, 0, { x: 0, y: 200 })))).toBe('DL');
    expect(recognizeGesture(path(drag(0, -200), drag(0, 200, { x: 0, y: -200 })))).toBe('UD');
  });

  /**
   * The guard that keeps a plain right-click from being eaten: a click carries
   * a pixel or two of jitter and must reduce to nothing.
   */
  it('reads a click, and a twitch, as no gesture', () => {
    expect(recognizeGesture([{ x: 100, y: 100 }])).toBe('');
    expect(recognizeGesture(drag(3, 2, { x: 100, y: 100 }))).toBe('');
    expect(recognizeGesture([])).toBe('');
  });

  it('ignores travel below the segment threshold', () => {
    expect(recognizeGesture(drag(GESTURE_SEGMENT_PX - 1, 0))).toBe('');
    expect(recognizeGesture(drag(GESTURE_SEGMENT_PX + 1, 0))).toBe('R');
  });

  it('takes the dominant axis of a sloppy stroke', () => {
    // Drifting 20px down over a 200px leftward drag is still "left".
    expect(recognizeGesture(drag(-200, 20))).toBe('L');
  });

  it('stops reading once a stroke is longer than any binding', () => {
    const zigzag = path(
      drag(200, 0),
      drag(0, 200, { x: 200, y: 0 }),
      drag(-200, 0, { x: 200, y: 200 }),
      drag(0, -200, { x: 0, y: 200 }),
      drag(200, 0),
      drag(0, 200, { x: 200, y: 0 }),
    );
    expect(recognizeGesture(zigzag).length).toBeLessThanOrEqual(GESTURE_MAX_SEGMENTS);
  });

  it('accepts a custom threshold', () => {
    expect(recognizeGesture(drag(12, 0), 10)).toBe('R');
    expect(recognizeGesture(drag(12, 0), 50)).toBe('');
  });
});

describe('gestureLabel', () => {
  it('renders strokes as arrows', () => {
    expect(gestureLabel('L')).toBe('←');
    expect(gestureLabel('DR')).toBe('↓→');
    expect(gestureLabel('UD')).toBe('↑↓');
    expect(gestureLabel('')).toBe('');
  });
});

describe('DEFAULT_GESTURES', () => {
  it('names only commands that exist', () => {
    for (const binding of DEFAULT_GESTURES) {
      expect(getCommand(binding.action), binding.action).toBeDefined();
    }
  });

  it('assigns each stroke to at most one command', () => {
    const strokes = DEFAULT_GESTURES.map((binding) => binding.gesture);
    expect(new Set(strokes).size).toBe(strokes.length);
  });

  it('uses only strokes the recogniser can actually produce', () => {
    for (const binding of DEFAULT_GESTURES) {
      expect(binding.gesture, binding.gesture).toMatch(/^[LRUD]{1,4}$/);
    }
  });
});
