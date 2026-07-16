import { describe, expect, it } from 'vitest';
import { convertTimezone } from '@shared/utils';

/** A fixed reference so every assertion is deterministic. 2026-07-16T12:00Z. */
const NOW = new Date('2026-07-16T12:00:00Z');

/** The wall-clock reading of a result in its own zone, as `HH:MM`. */
function wallClock(iso: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

describe('convertTimezone', () => {
  it('converts a named zone to another named zone', () => {
    const result = convertTimezone('9:30am est to pst', NOW);
    // 09:30 in New York (EDT, UTC-4) is 06:30 in Los Angeles (PDT, UTC-7).
    expect(result?.zone).toBe('America/Los_Angeles');
    expect(wallClock(result!.iso, 'America/Los_Angeles')).toBe('06:30');
    expect(wallClock(result!.iso, 'America/New_York')).toBe('09:30');
    expect(result?.dayOffset).toBe(0);
  });

  it('reports the current time in a zone', () => {
    const result = convertTimezone('time in tokyo', NOW);
    // 12:00Z is 21:00 JST (UTC+9) the same day.
    expect(result?.zone).toBe('Asia/Tokyo');
    expect(result?.iso).toBe(NOW.toISOString());
    expect(wallClock(result!.iso, 'Asia/Tokyo')).toBe('21:00');
  });

  it('accepts "now" as well as "time"', () => {
    expect(convertTimezone('now in utc', NOW)?.iso).toBe(NOW.toISOString());
  });

  it('tracks the date rolling over into the next day', () => {
    // 23:00 in New York is 04:00 the next day in London.
    const result = convertTimezone('11:00pm est in london', NOW);
    expect(wallClock(result!.iso, 'Europe/London')).toBe('04:00');
    expect(result?.dayOffset).toBe(1);
  });

  it('tracks the date rolling back into the previous day', () => {
    // Tokyo is UTC+9 and Los Angeles UTC-7 in July: a 16-hour gap, so 08:00 in
    // Tokyo is 16:00 the previous day in Los Angeles.
    const result = convertTimezone('8:00am tokyo to los angeles', NOW);
    expect(wallClock(result!.iso, 'America/Los_Angeles')).toBe('16:00');
    expect(result?.dayOffset).toBe(-1);
  });

  it('applies DST correctly for the date in question', () => {
    // London is on BST (UTC+1) in July but GMT (UTC+0) in January, so the same
    // query resolves to a different instant depending on the reference date.
    const summer = convertTimezone('12:00 london to utc', new Date('2026-07-16T00:00:00Z'));
    const winter = convertTimezone('12:00 london to utc', new Date('2026-01-16T00:00:00Z'));
    expect(wallClock(summer!.iso, 'UTC')).toBe('11:00');
    expect(wallClock(winter!.iso, 'UTC')).toBe('12:00');
  });

  it('handles a zone with a non-hour offset', () => {
    // India is UTC+5:30 and has no DST.
    const result = convertTimezone('12:00 utc in india', NOW);
    expect(wallClock(result!.iso, 'Asia/Kolkata')).toBe('17:30');
  });

  it('resolves raw IANA identifiers', () => {
    expect(convertTimezone('time in asia/tokyo', NOW)?.zone).toBe('Asia/Tokyo');
    expect(convertTimezone('time in Europe/Oslo', NOW)?.zone).toBe('Europe/Oslo');
  });

  it('resolves multi-word city names', () => {
    expect(convertTimezone('time in new york', NOW)?.zone).toBe('America/New_York');
    expect(convertTimezone('time in hong kong', NOW)?.zone).toBe('Asia/Hong_Kong');
  });

  it('reports the short zone name', () => {
    expect(convertTimezone('time in tokyo', NOW)?.abbreviation).toBe('GMT+9');
  });

  it('returns null for input that is not a timezone query', () => {
    expect(convertTimezone('hello world', NOW)).toBeNull();
    expect(convertTimezone('time in atlantis', NOW)).toBeNull();
    expect(convertTimezone('3pm', NOW)).toBeNull();
  });

  it('does not hijack unit conversions', () => {
    // These must fall through so the unit converter can answer them.
    expect(convertTimezone('1 hour in minutes', NOW)).toBeNull();
    expect(convertTimezone('10 km to miles', NOW)).toBeNull();
    expect(convertTimezone('20 miles in km', NOW)).toBeNull();
  });

  it('rejects impossible clock readings', () => {
    expect(convertTimezone('25:00 in tokyo', NOW)).toBeNull();
    expect(convertTimezone('13pm in tokyo', NOW)).toBeNull();
    expect(convertTimezone('9:75am in tokyo', NOW)).toBeNull();
  });
});
