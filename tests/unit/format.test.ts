import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatSpeed, truncate } from '@shared/utils';

describe('formatBytes', () => {
  it('formats sizes across units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatDuration(3661)).toBe('1h 1m');
    expect(formatDuration(-1)).toBe('—');
  });
});

describe('misc formatters', () => {
  it('formats speed', () => {
    expect(formatSpeed(1024)).toBe('1.0 KB/s');
  });
  it('truncates with an ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hell…');
    expect(truncate('hi', 5)).toBe('hi');
  });
});
