import { z } from 'zod';

/** A trigger's rectangle, in the chrome's CSS pixels. */
const anchor = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
});

export const popupOpenInput = z.object({
  kind: z.enum(['downloads', 'update', 'zoom']),
  anchor,
});

/**
 * Bounded because it sizes a native view: a popup that reported nonsense could
 * otherwise cover the window.
 */
export const popupResizeInput = z.object({
  width: z.number().finite().min(1).max(1200),
  height: z.number().finite().min(1).max(1200),
});
