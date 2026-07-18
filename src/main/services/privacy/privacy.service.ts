import { createRequire } from 'node:module';
import {
  ipcMain,
  type OnBeforeSendHeadersListenerDetails,
  type OnHeadersReceivedListenerDetails,
  type Session,
} from 'electron';
import { fromElectronDetails, type ElectronBlocker } from '@ghostery/adblocker-electron';
import type { BlockedResourceKind, ShieldReport } from '@shared/types';
import { getHostname, harmonizeClientHints } from '@shared/utils';
import type { Logger } from '../../core/logger';
import type { SettingsService } from '../settings.service';
import { BlockEngine } from './block-engine';
import { FilterEngineService } from './filter-engine';
import { FILTER_CATEGORIES, type FilterCategory } from './filter-lists';
import { shouldStripCookies, stripSetCookieHeaders } from './third-party';
import { isGoogleAuthUrl } from './google-auth-domains';

/**
 * IPC channels the bundled `@ghostery/adblocker` frame preload calls. They are
 * fixed by that package, and its handlers are global rather than per-session,
 * so they are registered exactly once.
 */
const COSMETIC_INJECT_CHANNEL = '@ghostery/adblocker/inject-cosmetic-filters';
const COSMETIC_MUTATION_CHANNEL = '@ghostery/adblocker/is-mutation-observer-enabled';

/**
 * On-disk path of the frame preload that performs element hiding.
 *
 * Resolved rather than imported: the file has to be handed to Electron as a
 * path, and `@ghostery/adblocker-electron` does not export its location. A
 * failure here costs cosmetic filtering only — network blocking is unaffected —
 * so it degrades to `null` instead of throwing during module load and taking
 * the whole main process down with it.
 */
const ADBLOCKER_PRELOAD_PATH: string | null = (() => {
  try {
    return createRequire(__filename).resolve('@ghostery/adblocker-electron-preload');
  } catch {
    return null;
  }
})();

interface ShieldCounters {
  ads: number;
  trackers: number;
  fingerprinters: number;
  thirdPartyCookies: number;
  httpsUpgraded: boolean;
}

const freshCounters = (): ShieldCounters => ({
  ads: 0,
  trackers: 0,
  fingerprinters: 0,
  thirdPartyCookies: 0,
  httpsUpgraded: false,
});

function isLocalHost(host: string): boolean {
  return (
    host === '' ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host === '::1'
  );
}

/**
 * Merge filter-supplied CSP directives into a response's existing policy.
 *
 * The site's own policy is kept and the new directives are appended, because
 * CSP intersects: several policies all apply and the strictest wins. Replacing
 * the header instead would let a `$csp` filter silently *relax* a site's own
 * protection, turning an ad-blocking rule into a security downgrade.
 */
export function applyCspDirectives(headers: Record<string, string[]>, directives: string): void {
  const policies = directives
    .split(';')
    .map((policy) => policy.trim())
    .filter(Boolean);

  for (const [name, values] of Object.entries(headers)) {
    if (name.toLowerCase() !== 'content-security-policy') continue;
    policies.push(...values);
    delete headers[name];
  }

  headers['content-security-policy'] = [policies.join(';')];
}

/** The shape both `onBeforeSendHeaders` and `onHeadersReceived` share here. */
type FramedRequestDetails = Pick<OnBeforeSendHeadersListenerDetails, 'frame'>;

/**
 * The document that owns this request's frame tree, read live. A tab's committed
 * URL still names the previous page while a navigation is in flight, so it
 * cannot answer this.
 */
function topUrlForRequest(details: FramedRequestDetails): string | null {
  try {
    const top = details.frame?.top;
    if (!top || top.isDestroyed()) return null;
    return top.url || null;
  } catch {
    // The frame can be disposed between the request and this callback.
    return null;
  }
}

/**
 * The privacy engine. It attaches request filtering to each Electron session:
 * ad/tracker/fingerprinter blocking, HTTPS upgrading, DNT/GPC headers and
 * third-party cookie stripping — and tracks per-tab shield counters for the UI.
 */
export class PrivacyService {
  readonly engine = new BlockEngine();
  readonly filters: FilterEngineService;
  private readonly counters = new Map<number, ShieldCounters>();
  private cosmeticHandlersRegistered = false;
  private preloadWarningLogged = false;
  private categoryCache: { key: number; categories: readonly FilterCategory[] } | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly logger: Logger,
  ) {
    this.filters = new FilterEngineService(logger);
    this.logger.info(`privacy engine ready (${this.engine.size} seed rules loaded)`);
  }

  /**
   * Bring the filter lists online. Awaiting this only waits for the on-disk
   * cache; downloads continue in the background, and until they land the
   * bundled seed blocklist answers on its own.
   */
  async initialize(): Promise<void> {
    await this.filters.initialize();
    if (this.filters.ready) {
      this.logger.info(`filter lists ready (${this.filters.size} network rules)`);
    }
  }

  /** Stop the background list-refresh timer. */
  dispose(): void {
    this.filters.dispose();
  }

  configureSession(session: Session): void {
    this.registerCosmeticFiltering(session);

    session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      const privacy = this.settings.get().privacy;
      const { url, webContentsId } = details;

      if (privacy.httpsUpgrade && url.startsWith('http://')) {
        const host = getHostname(url);
        if (!isLocalHost(host)) {
          this.markHttpsUpgrade(webContentsId);
          callback({ redirectURL: `https://${url.slice('http://'.length)}` });
          return;
        }
      }

      // Google's sign-in infrastructure is never blocked — a cancelled auth
      // request silently breaks Gmail/YouTube/Accounts. Its third-party ad and
      // tracker domains are separate registrable domains and stay blockable.
      if (
        (privacy.blockAds || privacy.blockTrackers || privacy.blockFingerprinting) &&
        !isGoogleAuthUrl(url)
      ) {
        // The filter lists are asked first: they carry the exception rules that
        // keep sites working, and an exception there must not be overruled by
        // the coarser domain-level seed list consulted below.
        const verdict = this.filters.match(details, this.enabledCategories(privacy));
        if (verdict?.action === 'redirect') {
          this.bump(webContentsId, verdict.category);
          callback({ redirectURL: verdict.url });
          return;
        }
        if (verdict?.action === 'block') {
          this.bump(webContentsId, verdict.category);
          callback({ cancel: true });
          return;
        }

        if (verdict === null) {
          const match = this.engine.match(url);
          if (match.blocked && match.kind && this.kindEnabled(match.kind, privacy)) {
            this.bump(webContentsId, match.kind);
            callback({ cancel: true });
            return;
          }
        }
      }

      callback({});
    });

    session.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
      const privacy = this.settings.get().privacy;
      const headers = details.requestHeaders;

      // The header half of the opt-in "present as Google Chrome" spoof: add a
      // "Google Chrome" brand to the Sec-CH-UA client hints. Gated with — and
      // useless without — its JavaScript counterpart in chrome-identity.ts, since
      // a header that claims Chrome while the page's navigator.userAgentData says
      // only Chromium is an inconsistency a real browser never has.
      if (privacy.spoofChromeIdentity) harmonizeClientHints(headers);

      if (privacy.doNotTrack) headers['DNT'] = '1';
      if (privacy.globalPrivacyControl) headers['Sec-GPC'] = '1';

      if (privacy.blockThirdPartyCookies) {
        const topUrl = topUrlForRequest(details);
        if (shouldStripCookies(details.resourceType, topUrl, details.url)) {
          delete headers['Cookie'];
          delete headers['cookie'];
          this.bump(details.webContentsId, 'thirdPartyCookie');
        }
      }

      callback({ requestHeaders: headers });
    });

    // The other half of the shield. Stripping `Cookie` alone stops third-party
    // cookies being *sent* while letting them be *stored* — so the jar fills up
    // with identifiers the shield merely declines to read, and a profile carries
    // a tracker's cookie on disk for as long as it lives. A cookie that is never
    // sent has no reason to be written.
    session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
      const privacy = this.settings.get().privacy;
      const headers = details.responseHeaders;
      if (!headers) {
        callback({});
        return;
      }

      let modified = false;

      // `$csp` filters block ad and anti-adblock scripts by tightening the
      // document's Content-Security-Policy, which is the only lever that works
      // on the inline script the request filters never see.
      const csp = this.cspDirectivesFor(details, privacy);
      if (csp) {
        applyCspDirectives(headers, csp);
        modified = true;
      }

      if (privacy.blockThirdPartyCookies) {
        const topUrl = topUrlForRequest(details);
        if (
          shouldStripCookies(details.resourceType, topUrl, details.url) &&
          stripSetCookieHeaders(headers)
        ) {
          this.bump(details.webContentsId, 'thirdPartyCookie');
          modified = true;
        }
      }

      // Only re-issue the headers when something actually changed: handing
      // `responseHeaders` back makes Electron rebuild the whole set, and the
      // common case is a response that needed no edit at all.
      callback(modified ? { responseHeaders: headers } : {});
    });
  }

  resetCounters(webContentsId: number): void {
    this.counters.delete(webContentsId);
  }

  report(webContentsId: number, origin: string): ShieldReport {
    const counters = this.counters.get(webContentsId) ?? freshCounters();
    return {
      origin,
      adsBlocked: counters.ads,
      trackersBlocked: counters.trackers,
      fingerprintersBlocked: counters.fingerprinters,
      httpsUpgraded: counters.httpsUpgraded,
      thirdPartyCookiesBlocked: counters.thirdPartyCookies,
    };
  }

  /**
   * The categories whose engines may answer, in the order they are consulted.
   * A category the user turned off is absent, so its lists cannot block.
   *
   * Memoised on the three flags that determine it. This runs for every request
   * the browser makes, and the toggles change perhaps a handful of times in a
   * session, so rebuilding the array each time is pure garbage.
   */
  private enabledCategories(privacy: {
    blockAds: boolean;
    blockTrackers: boolean;
    blockFingerprinting: boolean;
  }): readonly FilterCategory[] {
    const key =
      (privacy.blockAds ? 1 : 0) |
      (privacy.blockTrackers ? 2 : 0) |
      (privacy.blockFingerprinting ? 4 : 0);
    if (this.categoryCache?.key === key) return this.categoryCache.categories;

    const categories = FILTER_CATEGORIES.filter((category) => {
      switch (category) {
        case 'ad':
          return privacy.blockAds;
        case 'tracker':
          return privacy.blockTrackers;
        case 'fingerprinter':
          return privacy.blockFingerprinting;
      }
    });
    this.categoryCache = { key, categories };
    return categories;
  }

  /** `$csp` directives for a document request, or `undefined` when there are none. */
  private cspDirectivesFor(
    details: OnHeadersReceivedListenerDetails,
    privacy: { blockAds: boolean },
  ): string | undefined {
    if (!privacy.blockAds) return undefined;
    if (details.resourceType !== 'mainFrame' && details.resourceType !== 'subFrame') {
      return undefined;
    }
    const engine = this.filters.cosmeticEngine;
    if (!engine) return undefined;
    try {
      return engine.getCSPDirectives(fromElectronDetails(details));
    } catch {
      // A malformed URL must never fail a response.
      return undefined;
    }
  }

  /**
   * Enable element hiding for a session.
   *
   * The frame preload shipped by `@ghostery/adblocker` reports each document's
   * classes, ids and hrefs and applies the CSS and scriptlets we return. Its two
   * IPC handlers are process-global rather than per-session, so they are
   * registered once while the preload script is registered per session.
   *
   * Whether the filters actually apply is decided per request inside the
   * handler, so toggling `blockAds` takes effect on the next document without
   * re-registering anything.
   */
  private registerCosmeticFiltering(session: Session): void {
    if (!ADBLOCKER_PRELOAD_PATH) {
      if (!this.preloadWarningLogged) {
        this.preloadWarningLogged = true;
        this.logger.warn('cosmetic filtering unavailable: adblocker preload could not be resolved');
      }
      return;
    }

    session.registerPreloadScript({ type: 'frame', filePath: ADBLOCKER_PRELOAD_PATH });

    if (this.cosmeticHandlersRegistered) return;
    this.cosmeticHandlersRegistered = true;

    ipcMain.handle(COSMETIC_MUTATION_CHANNEL, async () => {
      const engine = this.filters.cosmeticEngine;
      return Boolean(engine) && this.settings.get().privacy.blockAds;
    });

    ipcMain.handle(COSMETIC_INJECT_CHANNEL, async (event, url: string, msg?: unknown) => {
      if (!this.settings.get().privacy.blockAds) return;
      const engine = this.filters.cosmeticEngine;
      if (!engine) return;
      if (typeof url !== 'string' || isGoogleAuthUrl(url)) return;
      await engine.onInjectCosmeticFilters(
        event,
        url,
        msg as Parameters<ElectronBlocker['onInjectCosmeticFilters']>[2],
      );
    });
  }

  private kindEnabled(
    kind: BlockedResourceKind,
    privacy: { blockAds: boolean; blockTrackers: boolean; blockFingerprinting: boolean },
  ): boolean {
    switch (kind) {
      case 'ad':
        return privacy.blockAds;
      case 'tracker':
        return privacy.blockTrackers;
      case 'fingerprinter':
        return privacy.blockFingerprinting;
      case 'cryptominer':
        return privacy.blockAds || privacy.blockTrackers;
      default:
        return false;
    }
  }

  private ensure(webContentsId: number | undefined): ShieldCounters | null {
    if (typeof webContentsId !== 'number' || webContentsId < 0) return null;
    let counters = this.counters.get(webContentsId);
    if (!counters) {
      counters = freshCounters();
      this.counters.set(webContentsId, counters);
    }
    return counters;
  }

  private markHttpsUpgrade(webContentsId: number | undefined): void {
    const counters = this.ensure(webContentsId);
    if (counters) counters.httpsUpgraded = true;
  }

  private bump(
    webContentsId: number | undefined,
    kind: BlockedResourceKind | 'thirdPartyCookie',
  ): void {
    const counters = this.ensure(webContentsId);
    if (!counters) return;
    switch (kind) {
      case 'ad':
        counters.ads += 1;
        break;
      case 'tracker':
      case 'cryptominer':
        counters.trackers += 1;
        break;
      case 'fingerprinter':
        counters.fingerprinters += 1;
        break;
      case 'thirdPartyCookie':
        counters.thirdPartyCookies += 1;
        break;
    }
  }
}
