import type { Session } from 'electron';
import type { BlockedResourceKind, ShieldReport } from '@shared/types';
import { getHostname, rootDomain } from '@shared/utils';
import type { Logger } from '../../core/logger';
import type { SettingsService } from '../settings.service';
import { BlockEngine } from './block-engine';

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

function isThirdParty(topUrl: string, requestUrl: string): boolean {
  const top = rootDomain(getHostname(topUrl));
  const req = rootDomain(getHostname(requestUrl));
  return Boolean(top) && Boolean(req) && top !== req;
}

/**
 * The privacy engine. It attaches request filtering to each Electron session:
 * ad/tracker/fingerprinter blocking, HTTPS upgrading, DNT/GPC headers and
 * third-party cookie stripping — and tracks per-tab shield counters for the UI.
 */
export class PrivacyService {
  readonly engine = new BlockEngine();
  private readonly counters = new Map<number, ShieldCounters>();
  private topUrlResolver: (webContentsId: number) => string | null = () => null;

  constructor(
    private readonly settings: SettingsService,
    private readonly logger: Logger,
  ) {
    this.logger.info(`privacy engine ready (${this.engine.size} rules loaded)`);
  }

  /** TabManager supplies this so third-party detection knows the document URL. */
  setTopUrlResolver(resolver: (webContentsId: number) => string | null): void {
    this.topUrlResolver = resolver;
  }

  configureSession(session: Session): void {
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

      if (privacy.blockAds || privacy.blockTrackers || privacy.blockFingerprinting) {
        const match = this.engine.match(url);
        if (match.blocked && match.kind && this.kindEnabled(match.kind, privacy)) {
          this.bump(webContentsId, match.kind);
          callback({ cancel: true });
          return;
        }
      }

      callback({});
    });

    session.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
      const privacy = this.settings.get().privacy;
      const headers = details.requestHeaders;

      if (privacy.doNotTrack) headers['DNT'] = '1';
      if (privacy.globalPrivacyControl) headers['Sec-GPC'] = '1';

      if (privacy.blockThirdPartyCookies && typeof details.webContentsId === 'number') {
        const topUrl = this.topUrlResolver(details.webContentsId);
        if (topUrl && isThirdParty(topUrl, details.url)) {
          delete headers['Cookie'];
          delete headers['cookie'];
          this.bump(details.webContentsId, 'thirdPartyCookie');
        }
      }

      callback({ requestHeaders: headers });
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
