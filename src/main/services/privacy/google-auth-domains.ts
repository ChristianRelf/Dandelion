import { getHostname } from '@shared/utils';

/**
 * Google's first-party sign-in infrastructure.
 *
 * Google authentication is cross-domain by design: signing into YouTube reads
 * your session from `google.com`, Gmail authorises its API calls to
 * `googleapis.com`, and "Sign in with Google" widgets embed `accounts.google.com`
 * in other sites. Every one of those is a *cross-site* request, so the privacy
 * shield's third-party-cookie stripping would send them cookieless and the sign-in
 * silently fails or loops. The request blocker could do the same if a domain were
 * ever caught by a rule. Requests to these domains are therefore left untouched —
 * the same carve-out a stock Chromium build grants Google's own auth while
 * third-party cookies are phased out.
 *
 * This is Google's *identity* infrastructure, not its advertising network:
 * third-party ad/tracker domains (`doubleclick.net`, `googlesyndication.com`,
 * `google-analytics.com`, `googletagmanager.com`, …) are separate registrable
 * domains and stay blocked. The one accepted cost is that Google's own
 * ad/analytics subdomains beneath these roots (e.g. `adservice.google.com`) are
 * no longer blocked by the built-in list — a deliberate choice to keep sign-in
 * reliable, since the auth flow touches many hosts under `google.com`.
 */
export const GOOGLE_AUTH_DOMAINS: readonly string[] = [
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'googleusercontent.com',
  'youtube.com',
];

/** Whether a URL belongs to Google's sign-in infrastructure (a domain above, or any subdomain). */
export function isGoogleAuthUrl(url: string): boolean {
  const host = getHostname(url).toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  return GOOGLE_AUTH_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
