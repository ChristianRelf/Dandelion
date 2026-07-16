import { describe, expect, it } from 'vitest';
import { deepMerge } from '@main/core/merge';

describe('deepMerge', () => {
  it('merges nested objects', () => {
    expect(deepMerge({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 } })).toEqual({
      a: 1,
      b: { c: 9, d: 3 },
    });
  });

  it('ignores undefined patch values', () => {
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });

  it('replaces arrays rather than merging them', () => {
    expect(deepMerge({ tags: [1, 2, 3] }, { tags: [9] })).toEqual({ tags: [9] });
  });

  it('replaces primitives', () => {
    expect(deepMerge({ mode: 'dark' }, { mode: 'light' })).toEqual({ mode: 'light' });
  });
});
