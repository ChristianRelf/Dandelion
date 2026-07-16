import type { WebContents } from 'electron';
import type {
  PermissionDecision,
  PermissionType,
  Profile,
  SitePermissionRule,
} from '@shared/types';
import { getOrigin } from '@shared/utils';
import { createId } from '@shared/utils';
import type { Repositories } from '../storage';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';

/** Map an Electron permission string to a Dandelion {@link PermissionType}. */
function mapPermission(permission: string, mediaTypes?: string[]): PermissionType | null {
  switch (permission) {
    case 'media':
      return mediaTypes?.includes('video') ? 'camera' : 'microphone';
    case 'geolocation':
      return 'geolocation';
    case 'notifications':
      return 'notifications';
    case 'clipboard-read':
      return 'clipboard-read';
    case 'clipboard-sanitized-write':
      return 'clipboard-write';
    case 'midi':
    case 'midiSysex':
      return 'midi';
    case 'pointerLock':
      return 'pointer-lock';
    case 'fullscreen':
      return 'fullscreen';
    case 'hid':
      return 'hid';
    case 'serial':
      return 'serial';
    case 'usb':
      return 'usb';
    case 'bluetooth':
      return 'bluetooth';
    case 'idle-detection':
      return 'idle-detection';
    case 'display-capture':
      return 'display-capture';
    case 'persistent-storage':
      return 'persistent-storage';
    default:
      return null;
  }
}

interface PendingRequest {
  callback: (allow: boolean) => void;
  profileId: string;
  origin: string;
  type: PermissionType;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Bridges Chromium permission prompts to Dandelion's per-site rules. Stored
 * `allow`/`block` decisions resolve instantly; `ask` emits a
 * `permission:request` event and parks the Electron callback until the renderer
 * responds via `permissions.respond`.
 */
export class PermissionsService {
  private readonly pending = new Map<string, PendingRequest>();
  private tabResolver: (webContents: WebContents) => string | null = () => null;

  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
    private readonly logger: Logger,
  ) {}

  setTabResolver(resolver: (webContents: WebContents) => string | null): void {
    this.tabResolver = resolver;
  }

  list(profileId: string, origin?: string): SitePermissionRule[] {
    return this.repos.permissions.list(profileId, origin);
  }

  set(
    profileId: string,
    origin: string,
    type: PermissionType,
    decision: PermissionDecision,
  ): SitePermissionRule {
    return this.repos.permissions.set(profileId, origin, type, decision);
  }

  remove(id: string): void {
    this.repos.permissions.remove(id);
  }

  clearOrigin(profileId: string, origin: string): void {
    this.repos.permissions.removeByOrigin(profileId, origin);
  }

  /** Wired into `session.setPermissionRequestHandler`. */
  handleRequest(
    profile: Profile,
    webContents: WebContents,
    permission: string,
    requestingUrl: string,
    mediaTypes: string[] | undefined,
    callback: (allow: boolean) => void,
  ): void {
    const type = mapPermission(permission, mediaTypes);
    const origin = getOrigin(requestingUrl);
    if (!type || !origin) {
      callback(false);
      return;
    }

    const existing = this.repos.permissions.get(profile.id, origin, type);
    if (existing && existing.decision !== 'ask') {
      callback(existing.decision === 'allow');
      return;
    }

    const requestId = createId('permreq');
    const timeout = setTimeout(() => this.resolve(requestId, false, false), 60_000);
    this.pending.set(requestId, { callback, profileId: profile.id, origin, type, timeout });

    this.events.emit({
      type: 'permission:request',
      request: {
        id: requestId,
        tabId: this.tabResolver(webContents) ?? '',
        origin,
        type,
      },
    });
  }

  /** Wired into `session.setPermissionCheckHandler` (synchronous). */
  handleCheck(profile: Profile, permission: string, requestingOrigin: string): boolean {
    const type = mapPermission(permission);
    if (!type) return false;
    const rule = this.repos.permissions.get(profile.id, requestingOrigin, type);
    return rule?.decision === 'allow';
  }

  /** Called by the renderer to answer an outstanding `ask` prompt. */
  respond(requestId: string, decision: 'allow' | 'block', remember: boolean): void {
    this.resolve(requestId, decision === 'allow', remember);
  }

  private resolve(requestId: string, allow: boolean, remember: boolean): void {
    const request = this.pending.get(requestId);
    if (!request) return;
    clearTimeout(request.timeout);
    this.pending.delete(requestId);

    if (remember) {
      this.repos.permissions.set(
        request.profileId,
        request.origin,
        request.type,
        allow ? 'allow' : 'block',
      );
    }
    this.logger.debug(
      `permission ${request.type} for ${request.origin}: ${allow ? 'allow' : 'block'}`,
    );
    request.callback(allow);
  }
}
