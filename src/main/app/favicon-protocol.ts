import { protocol } from 'electron';
import { FAVICON_SCHEME } from '@shared/constants';
import type { AppContext } from './app-context';

/** A 1×1 transparent GIF. The chrome falls back to its glyph on a 404 anyway. */
const EMPTY = new Response(null, { status: 404 });

/**
 * Serves `dandelion-favicon://icon?profile=<id>&url=<encoded>` by fetching the
 * icon **through that profile's session**.
 *
 * The chrome `BrowserWindow` has no session of its own, so it renders in the
 * default session. An `<img src>` pointing at a site-chosen favicon URL was
 * therefore fetched outside every profile partition: a persistent, on-disk jar
 * shared by every profile including private ones, with none of the privacy
 * engine's `webRequest` filters attached. A page in a private window setting
 * `<link rel="icon" href="https://tracker/id?u=123">` got that request issued
 * from a jar that outlives the private session and is shared with normal
 * browsing's favicons — so the tracker could correlate the two, unblocked and
 * uncounted.
 *
 * Routing through main fixes all three at once: the request lands in the right
 * partition, the block engine sees it, and the shields count it.
 */
export function registerFaviconProtocol(context: AppContext): void {
  protocol.handle(FAVICON_SCHEME, async (request) => {
    let target: URL;
    try {
      target = new URL(request.url);
    } catch {
      return EMPTY;
    }

    const profileId = target.searchParams.get('profile');
    const url = target.searchParams.get('url');
    if (!profileId || !url) return EMPTY;

    // The chrome builds these, but they are still addresses arriving over a
    // protocol handler — only fetch what a favicon can actually be.
    if (!/^https?:/i.test(url)) return EMPTY;

    const profile = context.profiles.get(profileId);
    if (!profile) return EMPTY;

    try {
      // `session.fetch` is the whole point: it issues the request *inside* that
      // partition, so the block engine's filters see it and a private profile's
      // jar takes the cookie and drops it on exit.
      const response = await context.sessions.getSession(profile).fetch(url, {
        // A favicon is decoration; it must never carry ambient authority.
        credentials: 'omit',
        redirect: 'follow',
      });
      if (!response.ok) return EMPTY;

      const type = response.headers.get('content-type') ?? '';
      if (!type.startsWith('image/')) return EMPTY;
      return response;
    } catch {
      // Offline, DNS failure, blocked by the engine — all the same to the
      // chrome, which renders its globe glyph.
      return EMPTY;
    }
  });
  context.logger.debug(`registered the ${FAVICON_SCHEME} protocol`);
}
