import { describe, expect, it } from 'vitest';
import { GOOGLE_AUTH_DOMAINS, isGoogleAuthUrl } from '@main/services/privacy/google-auth-domains';

describe('isGoogleAuthUrl', () => {
  it('matches Google sign-in infrastructure and its subdomains', () => {
    expect(isGoogleAuthUrl('https://accounts.google.com/ServiceLogin')).toBe(true);
    expect(isGoogleAuthUrl('https://apis.google.com/js/api.js')).toBe(true);
    expect(isGoogleAuthUrl('https://oauth2.googleapis.com/token')).toBe(true);
    expect(isGoogleAuthUrl('https://people.googleapis.com/v1/people')).toBe(true);
    expect(isGoogleAuthUrl('https://ssl.gstatic.com/accounts/x.png')).toBe(true);
    expect(isGoogleAuthUrl('https://lh3.googleusercontent.com/a/avatar')).toBe(true);
    expect(isGoogleAuthUrl('https://www.youtube.com/')).toBe(true);
  });

  it('matches the registrable domain itself, not only subdomains', () => {
    expect(isGoogleAuthUrl('https://google.com/')).toBe(true);
    expect(isGoogleAuthUrl('https://youtube.com/')).toBe(true);
  });

  it('does not match non-Google sites', () => {
    expect(isGoogleAuthUrl('https://example.com/')).toBe(false);
    expect(isGoogleAuthUrl('https://tracker.io/pixel.gif')).toBe(false);
  });

  // A look-alike must not slip through: endsWith without the dot boundary would
  // wrongly match "notgoogle.com" against "google.com".
  it('is not fooled by a look-alike suffix', () => {
    expect(isGoogleAuthUrl('https://notgoogle.com/')).toBe(false);
    expect(isGoogleAuthUrl('https://evilgoogle.com.attacker.net/')).toBe(false);
    expect(isGoogleAuthUrl('https://fakeyoutube.com/')).toBe(false);
  });

  it('handles a fully-qualified trailing dot and mixed case', () => {
    expect(isGoogleAuthUrl('https://Accounts.Google.com./')).toBe(true);
  });

  it('has no host to match for a malformed or schemeless URL', () => {
    expect(isGoogleAuthUrl('not a url')).toBe(false);
    expect(isGoogleAuthUrl('')).toBe(false);
  });

  it('exposes the exempt domains for diagnostics', () => {
    expect(GOOGLE_AUTH_DOMAINS).toContain('google.com');
    expect(GOOGLE_AUTH_DOMAINS).toContain('googleapis.com');
  });
});
