import { describe, expect, it } from 'vitest';
import { harmonizeClientHints } from '@shared/utils';

// What Electron actually advertises: an "Electron" brand, a real "Chromium"
// version, a greased brand — and no "Google Chrome". Google's sign-in reads the
// first and the absence of the last and calls the browser insecure.
const ELECTRON_SEC_CH_UA = '"Chromium";v="138", "Electron";v="43", "Not/A)Brand";v="8"';
const ELECTRON_FULL_LIST =
  '"Chromium";v="138.0.7204.100", "Electron";v="43.1.1", "Not/A)Brand";v="8.0.0.0"';

describe('harmonizeClientHints', () => {
  it('adds a Google Chrome brand mirroring the Chromium version and drops Electron', () => {
    const headers = { 'sec-ch-ua': ELECTRON_SEC_CH_UA };
    expect(harmonizeClientHints(headers)).toBe(true);
    expect(headers['sec-ch-ua']).toBe(
      '"Chromium";v="138", "Google Chrome";v="138", "Not/A)Brand";v="8"',
    );
    expect(headers['sec-ch-ua']).not.toContain('Electron');
  });

  it('mirrors the full version onto Google Chrome in the full-version-list hint', () => {
    const headers = { 'sec-ch-ua-full-version-list': ELECTRON_FULL_LIST };
    expect(harmonizeClientHints(headers)).toBe(true);
    expect(headers['sec-ch-ua-full-version-list']).toBe(
      '"Chromium";v="138.0.7204.100", "Google Chrome";v="138.0.7204.100", "Not/A)Brand";v="8.0.0.0"',
    );
  });

  it('preserves the greased Not-A-Brand entry verbatim — it is meant to be unpredictable', () => {
    const headers = { 'sec-ch-ua': '"Not?A_Brand";v="24", "Chromium";v="140", "Electron";v="44"' };
    harmonizeClientHints(headers);
    expect(headers['sec-ch-ua']).toContain('"Not?A_Brand";v="24"');
    expect(headers['sec-ch-ua']).toContain('"Google Chrome";v="140"');
  });

  it('matches the header name case-insensitively and writes back to the same key', () => {
    const headers = { 'Sec-CH-UA': ELECTRON_SEC_CH_UA };
    expect(harmonizeClientHints(headers)).toBe(true);
    expect(headers['Sec-CH-UA']).toContain('"Google Chrome";v="138"');
  });

  it('is idempotent — a second pass adds no duplicate Google Chrome brand', () => {
    const headers = { 'sec-ch-ua': ELECTRON_SEC_CH_UA };
    harmonizeClientHints(headers);
    const once = headers['sec-ch-ua'];
    expect(harmonizeClientHints(headers)).toBe(false);
    expect(headers['sec-ch-ua']).toBe(once);
  });

  it('leaves a value with no Chromium brand alone — a version cannot be fabricated', () => {
    const headers = { 'sec-ch-ua': '"Not/A)Brand";v="8"' };
    expect(harmonizeClientHints(headers)).toBe(false);
    expect(headers['sec-ch-ua']).toBe('"Not/A)Brand";v="8"');
  });

  it('ignores non-brand headers and requests that carry no client hints', () => {
    const headers = { 'sec-ch-ua-platform': '"Windows"', 'user-agent': 'Mozilla/5.0' };
    expect(harmonizeClientHints(headers)).toBe(false);
    expect(headers).toEqual({ 'sec-ch-ua-platform': '"Windows"', 'user-agent': 'Mozilla/5.0' });
  });
});
