import { app, session, type Cookie, type Session } from 'electron';
import type { CookieRecord, CookieSameSite, Profile } from '@shared/types';
import { APP_NAME } from '@shared/constants';
import type { Logger } from '../core/logger';
import type { SettingsService } from '../services/settings.service';
import type { PrivacyService } from '../services/privacy/privacy.service';
import type { PermissionsService } from '../services/permissions.service';
import type { DownloadsService } from '../services/downloads.service';

function toCookieRecord(cookie: Cookie): CookieRecord {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? '',
    path: cookie.path ?? '/',
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: (cookie.sameSite ?? 'unspecified') as CookieSameSite,
    session: cookie.expirationDate === undefined,
    expirationDate: cookie.expirationDate ?? null,
    hostOnly: Boolean(cookie.hostOnly),
  };
}

export interface ClearDataOptions {
  cookies: boolean;
  cache: boolean;
  storage: boolean;
}

/**
 * Creates and configures one Electron {@link Session} per profile partition,
 * applying the Chrome-like user agent, the privacy request filters, the
 * permission handlers and the download handler. Sessions are created lazily and
 * memoised by partition.
 */
export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly privacy: PrivacyService,
    private readonly permissions: PermissionsService,
    private readonly downloads: DownloadsService,
    private readonly settings: SettingsService,
    private readonly logger: Logger,
  ) {}

  getSession(profile: Profile): Session {
    const cached = this.sessions.get(profile.partition);
    if (cached) return cached;

    const partitionSession = session.fromPartition(profile.partition, {
      cache: !profile.isPrivate,
    });
    this.configure(partitionSession, profile);
    this.sessions.set(profile.partition, partitionSession);
    this.logger.debug(`configured session for partition ${profile.partition}`);
    return partitionSession;
  }

  /** Apply global secure-DNS configuration from settings (DoH is process-wide). */
  applySecureDns(): void {
    const dns = this.settings.get().privacy.secureDns;
    if (!dns.enabled) {
      app.configureHostResolver({ secureDnsMode: 'off' });
      return;
    }
    app.configureHostResolver({
      secureDnsMode: dns.mode === 'custom' ? 'secure' : 'automatic',
      secureDnsServers: dns.mode === 'custom' && dns.customUrl ? [dns.customUrl] : undefined,
    });
  }

  private configure(target: Session, profile: Profile): void {
    target.setUserAgent(this.chromeUserAgent(target));
    this.privacy.configureSession(target);

    target.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
      const requestingUrl =
        'requestingUrl' in details ? details.requestingUrl : webContents.getURL();
      this.permissions.handleRequest(
        profile,
        webContents,
        permission,
        requestingUrl || webContents.getURL(),
        mediaTypes,
        callback,
      );
    });

    target.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) =>
      this.permissions.handleCheck(profile, permission, requestingOrigin, details?.mediaType),
    );

    target.on('will-download', (_event, item) => {
      this.downloads.handleWillDownload(profile, item);
    });
  }

  /** Strip Electron/app tokens so sites see a stock Chrome UA. */
  private chromeUserAgent(target: Session): string {
    return target
      .getUserAgent()
      .replace(/ Electron\/[\d.]+/, '')
      .replace(new RegExp(` ${APP_NAME}\\/[\\d.]+`, 'i'), '');
  }

  /* ---- Cookies ---- */

  async getCookies(profile: Profile, domain?: string): Promise<CookieRecord[]> {
    const cookies = await this.getSession(profile).cookies.get(domain ? { domain } : {});
    return cookies.map(toCookieRecord);
  }

  async removeCookie(
    profile: Profile,
    name: string,
    domain: string,
    path: string,
    secure: boolean,
  ): Promise<void> {
    const scheme = secure ? 'https' : 'http';
    const url = `${scheme}://${domain.replace(/^\./, '')}${path}`;
    await this.getSession(profile).cookies.remove(url, name);
  }

  /* ---- Data clearing ---- */

  async clearData(profile: Profile, options: ClearDataOptions): Promise<void> {
    const target = this.getSession(profile);
    if (options.cache) await target.clearCache();
    const storages: Array<
      | 'cookies'
      | 'localstorage'
      | 'indexdb'
      | 'serviceworkers'
      | 'cachestorage'
      | 'filesystem'
      | 'shadercache'
    > = [];
    if (options.cookies) storages.push('cookies');
    if (options.storage) {
      storages.push('localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'filesystem');
    }
    if (storages.length > 0) {
      await target.clearStorageData({ storages });
    }
  }
}
