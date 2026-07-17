import { describe, expect, it } from 'vitest';
import { isWebContentUrl } from '@shared/utils';
import { INTERNAL_PAGES } from '@shared/constants';

/**
 * Guards the one place a page-supplied URL enters the browser:
 * `setWindowOpenHandler` hands it to `createTab` → `activate` → `loadURL`, from
 * the **main process** — so Chromium's renderer-side scheme rules are not in the
 * path and this predicate is the only thing standing there.
 */
describe('isWebContentUrl', () => {
  it('allows the web', () => {
    expect(isWebContentUrl('https://example.com/')).toBe(true);
    expect(isWebContentUrl('http://example.com/path?a=1#x')).toBe(true);
  });

  // An OAuth popup opens about:blank and writes into it directly.
  it('allows about:blank, which a popup opener writes into', () => {
    expect(isWebContentUrl('about:blank')).toBe(true);
  });

  // The defect: `window.open('dandelion://passwords')` reached `isInternalUrl`,
  // which destroyed the web view and rendered the internal password manager in
  // the privileged chrome. Web content must not be able to drive internal UI.
  it('refuses the internal scheme, including the password manager', () => {
    expect(isWebContentUrl(INTERNAL_PAGES.passwords)).toBe(false);
    expect(isWebContentUrl('dandelion://settings')).toBe(false);
  });

  it('refuses schemes that reach the machine or the renderer', () => {
    expect(isWebContentUrl('file:///etc/passwd')).toBe(false);
    expect(isWebContentUrl('javascript:alert(1)')).toBe(false);
    expect(isWebContentUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isWebContentUrl('chrome://settings')).toBe(false);
    expect(isWebContentUrl('devtools://devtools/bundled/inspector.html')).toBe(false);
  });

  it('refuses what does not parse, rather than throwing', () => {
    expect(isWebContentUrl('')).toBe(false);
    expect(isWebContentUrl('not a url')).toBe(false);
    expect(isWebContentUrl('about:blank#not-quite')).toBe(false);
  });
});
