import { z } from 'zod';

export const zId = z.string().min(1);
export const zOptionalId = zId.nullable();
export const zUrl = z.string().min(1).max(8192);
export const zHexColor = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
export const zTimestamp = z.number().int().nonnegative();
export const zNonEmptyString = z.string().min(1);
export const zTabGroupColor = z.enum([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]);
