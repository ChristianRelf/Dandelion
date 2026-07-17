/**
 * First-party vs. third-party classification for the cookie shield, and the
 * header edits it implies. Kept apart from the session plumbing in
 * `privacy.service.ts` so the decisions themselves are pure functions that can
 * be tested without an Electron session.
 */

import type { OnBeforeSendHeadersListenerDetails } from 'electron';
import { getHostname } from '@shared/utils';
import { registrableDomain } from './public-suffix';

type ResourceType = OnBeforeSendHeadersListenerDetails['resourceType'];

/**
 * The key two URLs must share to be same-site.
 *
 * Deliberately **not** `rootDomain` from `@shared/utils`: that counts labels,
 * which reduces `bbc.co.uk` and `tracker.co.uk` alike to `co.uk` and hands back
 * "first-party" for a tracker. It is fine for grouping a history list and has
 * never been fit for a privacy decision.
 *
 * Where the list names no registrable domain — an IP literal, `localhost`, an
 * internal `dandelion://` page — the host stands as its own site. Nothing can be
 * registered beneath it, so it can only ever be same-site with itself.
 */
function siteOf(url: string): string | null {
  const host = getHostname(url);
  if (!host) return null;
  return registrableDomain(host) ?? host;
}

/** Do these two URLs belong to different sites? */
export function isThirdParty(topUrl: string, requestUrl: string): boolean {
  const top = siteOf(topUrl);
  const req = siteOf(requestUrl);
  return Boolean(top) && Boolean(req) && top !== req;
}

/**
 * Should this exchange's cookies be stripped — the `Cookie` header on the way
 * out, `Set-Cookie` on the way back?
 *
 * One decision serves both directions because it is one question: does this
 * request belong to the document it is being made from? Sending and storing
 * have to agree, or the shield blocks a cookie it later hands back.
 *
 * A `mainFrame` request *is* the document being loaded, so it is first-party by
 * definition and is never stripped. Comparing it against the page it is leaving
 * would classify every cross-site navigation as third-party against itself and
 * send it out cookieless, which logs the user out of the destination.
 *
 * Everything else is judged against the document owning its frame tree. An
 * unknown top URL fails open: without a document to compare against there is no
 * evidence the request is third-party, and stripping on a guess breaks pages.
 */
export function shouldStripCookies(
  resourceType: ResourceType,
  topUrl: string | null,
  requestUrl: string,
): boolean {
  if (resourceType === 'mainFrame') return false;
  if (!topUrl) return false;
  return isThirdParty(topUrl, requestUrl);
}

/**
 * Remove every `Set-Cookie` header, mutating `headers` in place, and report
 * whether any were there. Casing is not assumed: request headers are
 * Chromium's own and predictable, but these are the server's.
 *
 * The caller counts a shield hit only on `true`, so the tally stays a count of
 * cookies actually blocked rather than of third-party responses seen.
 */
export function stripSetCookieHeaders(headers: Record<string, string | string[]>): boolean {
  let stripped = false;
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'set-cookie') {
      delete headers[name];
      stripped = true;
    }
  }
  return stripped;
}
