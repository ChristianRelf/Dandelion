import { describe, expect, it } from 'vitest';
import {
  FILTER_CATEGORIES,
  FILTER_LISTS,
  FILTER_REFRESH_INTERVAL_MS,
  listSignature,
} from '@main/services/privacy/filter-lists';

describe('filter list catalogue', () => {
  it('gives every category at least one list', () => {
    for (const category of FILTER_CATEGORIES) {
      expect(FILTER_LISTS[category].length).toBeGreaterThan(0);
    }
  });

  it('only serves lists over https', () => {
    for (const category of FILTER_CATEGORIES) {
      for (const url of FILTER_LISTS[category]) {
        expect(url.startsWith('https://')).toBe(true);
      }
    }
  });

  it('keeps categories disjoint so a blocked request has one owner', () => {
    const seen = new Set<string>();
    for (const category of FILTER_CATEGORIES) {
      for (const url of FILTER_LISTS[category]) {
        expect(seen.has(url)).toBe(false);
        seen.add(url);
      }
    }
  });

  it('derives a signature that changes when the catalogue changes', () => {
    for (const category of FILTER_CATEGORIES) {
      expect(listSignature(category)).toBe(FILTER_LISTS[category].join('|'));
    }
    expect(listSignature('ad')).not.toBe(listSignature('tracker'));
  });

  it('refreshes often enough to track upstream but not on every launch', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(FILTER_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(day);
    expect(FILTER_REFRESH_INTERVAL_MS).toBeLessThanOrEqual(7 * day);
  });
});
