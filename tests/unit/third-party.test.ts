import { describe, expect, it } from 'vitest';
import {
  isThirdParty,
  shouldStripCookies,
  stripSetCookieHeaders,
} from '@main/services/privacy/third-party';
import { registrableDomain } from '@main/services/privacy/public-suffix';

describe('registrableDomain', () => {
  it('resolves a single-label suffix', () => {
    expect(registrableDomain('example.com')).toBe('example.com');
    expect(registrableDomain('cdn.example.com')).toBe('example.com');
    expect(registrableDomain('a.b.c.example.com')).toBe('example.com');
  });

  // The defect this file exists for: two labels is right for `.com` and wrong
  // for every multi-part suffix.
  it('resolves a multi-part suffix', () => {
    expect(registrableDomain('bbc.co.uk')).toBe('bbc.co.uk');
    expect(registrableDomain('www.bbc.co.uk')).toBe('bbc.co.uk');
    expect(registrableDomain('tracker.co.uk')).toBe('tracker.co.uk');
    expect(registrableDomain('shop.com.au')).toBe('shop.com.au');
    expect(registrableDomain('www.shop.com.au')).toBe('shop.com.au');
    expect(registrableDomain('example.co.jp')).toBe('example.co.jp');
  });

  it('has no registrable domain for a bare public suffix', () => {
    expect(registrableDomain('com')).toBeNull();
    expect(registrableDomain('co.uk')).toBeNull();
    expect(registrableDomain('com.au')).toBeNull();
  });

  // An address is not a name; counting labels would make this `0.1`.
  it('has no registrable domain for an IP literal or an intranet name', () => {
    expect(registrableDomain('127.0.0.1')).toBeNull();
    expect(registrableDomain('192.168.1.1')).toBeNull();
    expect(registrableDomain('[::1]')).toBeNull();
    expect(registrableDomain('localhost')).toBeNull();
  });

  it('applies wildcard and exception rules', () => {
    // `*.kobe.jp` makes any `<x>.kobe.jp` a suffix...
    expect(registrableDomain('foo.bar.kobe.jp')).toBe('foo.bar.kobe.jp');
    // ...and `!city.kobe.jp` hands that one back to a registrant.
    expect(registrableDomain('www.city.kobe.jp')).toBe('city.kobe.jp');
  });

  // The upstream list is unicode; `URL.hostname` is punycode. If the generator
  // ever stops encoding, these fall back to the TLD and the shield fails open
  // across every IDN ccTLD — silently, which is why they are pinned.
  it('resolves punycode IDN suffixes', () => {
    expect(registrableDomain('xn--80aswg.xn--p1ai')).toBe('xn--80aswg.xn--p1ai'); // сайт.рф
    expect(registrableDomain('www.xn--fiqs8s')).toBe('www.xn--fiqs8s'); // 中国
  });

  // The private section is what gives mutually-untrusted sites on one platform
  // separate cookie boundaries, and is what Chromium's own jar uses.
  it('applies the private section', () => {
    expect(registrableDomain('alice.github.io')).toBe('alice.github.io');
    expect(registrableDomain('bob.github.io')).toBe('bob.github.io');
  });

  it('normalises case and a fully-qualified trailing dot', () => {
    expect(registrableDomain('CDN.Example.COM')).toBe('example.com');
    expect(registrableDomain('example.com.')).toBe('example.com');
  });

  it('resolves an unknown TLD to its last two labels', () => {
    expect(registrableDomain('foo.example.invalidtld')).toBe('example.invalidtld');
  });
});

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

  // The shield's fail-open bug, at the level the user met it: on a `.co.uk`
  // page every third party kept its cookies, because label counting reduced
  // both sides to `co.uk`.
  it('classifies across a multi-part suffix', () => {
    expect(isThirdParty('https://www.bbc.co.uk/news', 'https://tracker.co.uk/pixel.gif')).toBe(
      true,
    );
    expect(isThirdParty('https://shop.com.au/', 'https://ads.com.au/beacon')).toBe(true);
    expect(isThirdParty('https://example.co.jp/', 'https://tracker.co.jp/x')).toBe(true);
  });

  // The other side of the same coin: a site's own subdomains must stay
  // first-party across a multi-part suffix, or this fix becomes the v0.2.1 P1.
  it('keeps a multi-part-suffix site first-party with itself', () => {
    expect(isThirdParty('https://www.bbc.co.uk/news', 'https://static.bbc.co.uk/app.js')).toBe(
      false,
    );
    expect(isThirdParty('https://shop.com.au/', 'https://cdn.shop.com.au/x.css')).toBe(false);
  });

  it('keeps a localhost dev server first-party with itself', () => {
    expect(isThirdParty('http://localhost:3000/', 'http://localhost:5000/api')).toBe(false);
    expect(isThirdParty('http://127.0.0.1:3000/', 'http://127.0.0.1:5000/api')).toBe(false);
  });

  // Would regress if `registrableDomain` returning null were read as "same
  // site" rather than "the list has nothing to say".
  it('still shields a page served from localhost or an IP', () => {
    expect(isThirdParty('http://localhost:3000/', 'https://tracker.io/pixel')).toBe(true);
    expect(isThirdParty('http://127.0.0.1:3000/', 'https://tracker.io/pixel')).toBe(true);
  });

  it('separates two sites sharing a private-section suffix', () => {
    expect(isThirdParty('https://alice.github.io/', 'https://bob.github.io/x.js')).toBe(true);
  });
});

describe('shouldStripCookies', () => {
  // The regression this suite exists for: a top-level navigation's request is
  // sent before the new URL commits, so judging it against the previous page
  // classified every cross-site navigation as third-party against itself and
  // sent it out cookieless — every site appeared logged-out on first hit.
  it('never strips a top-level document request, whatever it is navigating from', () => {
    expect(
      shouldStripCookies(
        'mainFrame',
        'dandelion://newtab',
        'https://accounts.google.com/ServiceLogin',
      ),
    ).toBe(false);
    expect(
      shouldStripCookies('mainFrame', 'https://example.com/', 'https://accounts.google.com/'),
    ).toBe(false);
  });

  // The same trap, now reachable on the response half: a top-level navigation
  // must be able to *set* its session cookie, or adding the `Set-Cookie` strip
  // re-creates the v0.2.1 P1 in the other direction — sign-in would complete
  // and store nothing.
  it('never strips a top-level document response, across a multi-part suffix too', () => {
    expect(shouldStripCookies('mainFrame', 'https://google.com/', 'https://www.bbc.co.uk/')).toBe(
      false,
    );
    expect(shouldStripCookies('mainFrame', 'dandelion://newtab', 'https://shop.com.au/')).toBe(
      false,
    );
  });

  it('strips a cross-site subresource', () => {
    expect(
      shouldStripCookies('image', 'https://example.com/', 'https://tracker.io/pixel.gif'),
    ).toBe(true);
    expect(shouldStripCookies('xhr', 'https://example.com/', 'https://ads.net/beacon')).toBe(true);
    expect(shouldStripCookies('subFrame', 'https://example.com/', 'https://tracker.io/frame')).toBe(
      true,
    );
  });

  it('strips a cross-site subresource on a multi-part-suffix page', () => {
    expect(
      shouldStripCookies('image', 'https://www.bbc.co.uk/news', 'https://tracker.co.uk/pixel.gif'),
    ).toBe(true);
  });

  it('keeps cookies on a same-site subresource', () => {
    expect(
      shouldStripCookies('script', 'https://example.com/', 'https://cdn.example.com/app.js'),
    ).toBe(false);
    expect(
      shouldStripCookies('script', 'https://www.bbc.co.uk/', 'https://static.bbc.co.uk/app.js'),
    ).toBe(false);
  });

  it('fails open when the owning document is unknown', () => {
    expect(shouldStripCookies('image', null, 'https://tracker.io/pixel.gif')).toBe(false);
  });

  // Google sign-in is cross-domain by design, so its cookies would otherwise be
  // stripped as third-party and log the user out. The exemption keeps SSO working
  // while every other cross-site cookie is still shielded.
  describe('Google sign-in exemption', () => {
    it('keeps Google auth cookies on cross-site subresources and iframes', () => {
      // YouTube reading the Google session.
      expect(
        shouldStripCookies('xhr', 'https://www.youtube.com/', 'https://accounts.google.com/token'),
      ).toBe(false);
      // Gmail authorising an API call.
      expect(
        shouldStripCookies('xhr', 'https://mail.google.com/', 'https://people.googleapis.com/v1'),
      ).toBe(false);
      // "Sign in with Google" one-tap iframe embedded on any site.
      expect(
        shouldStripCookies('subFrame', 'https://news.example/', 'https://accounts.google.com/gsi'),
      ).toBe(false);
    });

    it('still strips non-Google trackers on a Google page', () => {
      expect(
        shouldStripCookies('image', 'https://www.google.com/search', 'https://tracker.io/px.gif'),
      ).toBe(true);
    });
  });
});

describe('stripSetCookieHeaders', () => {
  it('removes Set-Cookie whatever the server capitalised it as', () => {
    const headers: Record<string, string | string[]> = {
      'Set-Cookie': ['id=1; Path=/'],
      'Content-Type': 'image/gif',
    };
    expect(stripSetCookieHeaders(headers)).toBe(true);
    expect(headers).toEqual({ 'Content-Type': 'image/gif' });

    const lower: Record<string, string | string[]> = { 'set-cookie': ['id=1'] };
    expect(stripSetCookieHeaders(lower)).toBe(true);
    expect(lower).toEqual({});

    const shouty: Record<string, string | string[]> = { 'SET-COOKIE': ['id=1'] };
    expect(stripSetCookieHeaders(shouty)).toBe(true);
    expect(shouty).toEqual({});
  });

  // The service counts a shield hit and re-issues the header set only on
  // `true`, so this is what keeps the tally honest and the common path cheap.
  it('reports false and touches nothing when no cookie was set', () => {
    const headers: Record<string, string | string[]> = { 'Content-Type': 'image/gif' };
    expect(stripSetCookieHeaders(headers)).toBe(false);
    expect(headers).toEqual({ 'Content-Type': 'image/gif' });
  });

  it('leaves other cookie-adjacent headers alone', () => {
    const headers: Record<string, string | string[]> = {
      'Set-Cookie2': ['id=1'],
      Cookie: 'id=1',
    };
    expect(stripSetCookieHeaders(headers)).toBe(false);
    expect(headers).toEqual({ 'Set-Cookie2': ['id=1'], Cookie: 'id=1' });
  });
});
