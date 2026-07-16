import { describe, expect, it } from 'vitest';
import { isThirdParty, shouldStripCookies } from '@main/services/privacy/third-party';

describe('isThirdParty', () => {
  it('treats different registrable domains as third-party', () => {
    expect(isThirdParty('https://example.com/', 'https://tracker.io/pixel')).toBe(true);
  });

  it('treats subdomains of the same registrable domain as first-party', () => {
    expect(isThirdParty('https://accounts.google.com/', 'https://apis.google.com/x')).toBe(false);
    expect(isThirdParty('https://example.com/', 'https://cdn.example.com/app.js')).toBe(false);
  });

  it('cannot classify a URL with no hostname', () => {
    expect(isThirdParty('https://example.com/', 'about:blank')).toBe(false);
    expect(isThirdParty('', 'https://example.com/')).toBe(false);
  });

  // `new URL('dandelion://newtab').hostname` is 'newtab', so an internal page
  // reads as a domain that matches nothing. This is why the mainFrame exemption
  // in shouldStripCookies — not a special case for internal pages — is the fix:
  // navigating from *any* other origin classifies the same way.
  it('reads an internal page as a domain distinct from every site', () => {
    expect(isThirdParty('dandelion://newtab', 'https://accounts.google.com/')).toBe(true);
  });
});

describe('shouldStripCookies', () => {
  // The regression this suite exists for: a top-level navigation's request is
  // sent before the new URL commits, so judging it against the previous page
  // classified every cross-site navigation as third-party against itself and
  // sent it out cookieless — every site appeared logged-out on first hit.
  it('never strips a top-level document request, whatever it is navigating from', () => {
    expect(
      shouldStripCookies('mainFrame', 'dandelion://newtab', 'https://accounts.google.com/ServiceLogin'),
    ).toBe(false);
    expect(
      shouldStripCookies('mainFrame', 'https://example.com/', 'https://accounts.google.com/'),
    ).toBe(false);
  });

  it('strips a cross-site subresource', () => {
    expect(shouldStripCookies('image', 'https://example.com/', 'https://tracker.io/pixel.gif')).toBe(
      true,
    );
    expect(shouldStripCookies('xhr', 'https://example.com/', 'https://ads.net/beacon')).toBe(true);
    expect(shouldStripCookies('subFrame', 'https://example.com/', 'https://tracker.io/frame')).toBe(
      true,
    );
  });

  it('keeps cookies on a same-site subresource', () => {
    expect(
      shouldStripCookies('script', 'https://example.com/', 'https://cdn.example.com/app.js'),
    ).toBe(false);
  });

  it('fails open when the owning document is unknown', () => {
    expect(shouldStripCookies('image', null, 'https://tracker.io/pixel.gif')).toBe(false);
  });
});
