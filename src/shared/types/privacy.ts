import type { PermissionRuleId, ProfileId } from './ids';

/* ------------------------------------------------------------------ *
 * Site permissions
 * ------------------------------------------------------------------ */

export type PermissionType =
  | 'camera'
  | 'microphone'
  | 'geolocation'
  | 'notifications'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'midi'
  | 'bluetooth'
  | 'usb'
  | 'serial'
  | 'hid'
  | 'filesystem'
  | 'idle-detection'
  | 'popups'
  | 'autoplay'
  | 'pointer-lock'
  | 'fullscreen'
  | 'display-capture'
  | 'persistent-storage';

export type PermissionDecision = 'allow' | 'block' | 'ask';

export interface SitePermissionRule {
  id: PermissionRuleId;
  profileId: ProfileId;
  /** Origin the rule applies to, e.g. `https://example.com`. */
  origin: string;
  type: PermissionType;
  decision: PermissionDecision;
  updatedAt: number;
}

/* ------------------------------------------------------------------ *
 * Cookies (a serialisable view over the Electron session cookie store)
 * ------------------------------------------------------------------ */

export type CookieSameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified';

export interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: CookieSameSite;
  /** Session cookie (no expiry). */
  session: boolean;
  expirationDate: number | null;
  hostOnly: boolean;
}

/* ------------------------------------------------------------------ *
 * Connection security / certificate inspection
 * ------------------------------------------------------------------ */

export interface CertificateInfo {
  subjectName: string;
  issuerName: string;
  validStart: number;
  validExpiry: number;
  fingerprint: string;
  serialNumber: string;
}

export type SecurityLevel = 'secure' | 'insecure' | 'broken' | 'internal';

export interface SecurityInfo {
  url: string;
  level: SecurityLevel;
  certificate: CertificateInfo | null;
  hasMixedContent: boolean;
}

/* ------------------------------------------------------------------ *
 * Privacy engine reporting
 * ------------------------------------------------------------------ */

export type BlockedResourceKind = 'ad' | 'tracker' | 'fingerprinter' | 'cryptominer';

export interface BlockedResource {
  url: string;
  kind: BlockedResourceKind;
  sourceHost: string;
  blockedAt: number;
}

/** Aggregate per-tab privacy shield report shown in the site info popover. */
export interface ShieldReport {
  origin: string;
  adsBlocked: number;
  trackersBlocked: number;
  fingerprintersBlocked: number;
  httpsUpgraded: boolean;
  thirdPartyCookiesBlocked: number;
}
