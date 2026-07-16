/**
 * First-party vs. third-party classification for the cookie shield. Kept apart
 * from the session plumbing in `privacy.service.ts` so the decision itself is a
 * pure function that can be tested without an Electron session.
 */

import type { OnBeforeSendHeadersListenerDetails } from 'electron';
import { getHostname, rootDomain } from '@shared/utils';

type ResourceType = OnBeforeSendHeadersListenerDetails['resourceType'];

/** Do these two URLs belong to different registrable domains? */
export function isThirdParty(topUrl: string, requestUrl: string): boolean {
  const top = rootDomain(getHostname(topUrl));
  const req = rootDomain(getHostname(requestUrl));
  return Boolean(top) && Boolean(req) && top !== req;
}

/**
 * Should this request's `Cookie` header be stripped?
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
