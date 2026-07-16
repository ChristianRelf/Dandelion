import { describe, expect, it } from 'vitest';
import { convertUnits } from '@shared/utils';

describe('convertUnits', () => {
  it('converts length', () => {
    expect(convertUnits('10 km to miles')?.value).toBeCloseTo(6.2137, 3);
  });
  it('converts temperature with offsets', () => {
    expect(convertUnits('100 c to f')?.value).toBeCloseTo(212, 6);
    expect(convertUnits('32 f to c')?.value).toBeCloseTo(0, 6);
  });
  it('converts data sizes (binary)', () => {
    expect(convertUnits('1 gb to mb')?.value).toBe(1024);
  });
  it('accepts the "in" keyword', () => {
    expect(convertUnits('1 hour in minutes')?.value).toBe(60);
  });
  it('returns null for non-conversions and mismatched categories', () => {
    expect(convertUnits('hello world')).toBeNull();
    expect(convertUnits('10 km to kg')).toBeNull();
  });
});
