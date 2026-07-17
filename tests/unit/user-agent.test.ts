import { describe, expect, it } from 'vitest';
import { stripBrandingFromUserAgent } from '@shared/utils';

const ELECTRON_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Dandelion/0.2.9 Chrome/138.0.0.0 Electron/43.1.1 Safari/537.36';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/138.0.0.0 Safari/537.36';

describe('stripBrandingFromUserAgent', () => {
  it('removes the Electron and app tokens, leaving a stock Chrome UA', () => {
    expect(stripBrandingFromUserAgent(ELECTRON_UA, 'Dandelion')).toBe(CHROME_UA);
  });

  it('keeps the real Chromium version intact — no spoofing', () => {
    expect(stripBrandingFromUserAgent(ELECTRON_UA, 'Dandelion')).toContain('Chrome/138.0.0.0');
    expect(stripBrandingFromUserAgent(ELECTRON_UA, 'Dandelion')).not.toContain('Electron');
  });

  it('matches the app token case-insensitively', () => {
    const lower = ELECTRON_UA.replace('Dandelion/', 'dandelion/');
    expect(stripBrandingFromUserAgent(lower, 'Dandelion')).toBe(CHROME_UA);
  });

  it('is a no-op on a UA that already carries neither token', () => {
    expect(stripBrandingFromUserAgent(CHROME_UA, 'Dandelion')).toBe(CHROME_UA);
  });
});
