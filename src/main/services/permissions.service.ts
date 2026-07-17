import type { WebContents } from 'electron';
import type {
  PermissionDecision,
  PermissionType,
  Profile,
  SitePermissionRule,
  TabId,
  WindowId,
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
 * The tab a permission request came from, and the window showing that tab —
 * everything the prompt needs to be asked in exactly one place. Resolved by
 * `TabManager`, which owns the webContents → tab mapping.
 */
export interface RequestingTab {
  tabId: TabId;
  windowId: WindowId;
}

/**
 * Bridges Chromium permission prompts to Dandelion's per-site rules. Stored
 * `allow`/`block` decisions resolve instantly; `ask` emits a
 * `permission:request` event and parks the Electron callback until the renderer
 * responds via `permissions.respond`.
 */
export class PermissionsService {
  private readonly pending = new Map<string, PendingRequest>();
  private tabResolver: (webContents: WebContents) => RequestingTab | null = () => null;

  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
    private readonly logger: Logger,
  ) {}

  setTabResolver(resolver: (webContents: WebContents) => RequestingTab | null): void {
    this.tabResolver = resolver;
  }

  list(profileId: string, origin?: string): SitePermissionRule[] {
    return this.repos.permissions.list(profileId, origin);
  }

  /**
   * The stored decision for a site, or `null` if it has never been asked about.
   *
   * For permissions Chromium prompts for, `handleCheck`/`handleRequest` own the
   * resolution. This is for the ones Dandelion decides itself — `popups` is not
   * an Electron permission type at all, it is settled in `setWindowOpenHandler`
   * — which is why the Pop-ups row in Settings had nothing reading it.
   */
  decisionFor(profileId: string, origin: string, type: PermissionType): PermissionDecision | null {
    return this.repos.permissions.get(profileId, origin, type)?.decision ?? null;
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

    // A stored rule needs no prompt, so attribution is only required past this
    // point. A request that cannot be placed in a window has no honest way to be
    // asked: the event reaches every window, so an unattributed prompt appeared
    // in all of them, next to a tab that never made it. Refusing is the
    // conservative answer, and it is logged rather than silent.
    const requestingTab = this.tabResolver(webContents);
    if (!requestingTab) {
      this.logger.warn(`denied ${type} for ${origin}: no tab owns the requesting webContents`);
      callback(false);
      return;
    }

    const requestId = createId('permreq');
    const timeout = setTimeout(() => this.resolve(requestId, false, false), 60_000);
    this.pending.set(requestId, { callback, profileId: profile.id, origin, type, timeout });

    this.events.emit({
      type: 'permission:request',
      request: {
        id: requestId,
        tabId: requestingTab.tabId,
        windowId: requestingTab.windowId,
        origin,
        type,
      },
    });
  }

  /** Wired into `session.setPermissionCheckHandler` (synchronous). */
  handleCheck(
    profile: Profile,
    permission: string,
    requestingOrigin: string,
    mediaType?: 'video' | 'audio' | 'unknown',
  ): boolean {
    // Electron reports one `mediaType` when checking but a `mediaTypes` array
    // when requesting. Without this, a camera check resolves against the
    // microphone rule — reading back the wrong decision for both.
    const type = mapPermission(permission, mediaType ? [mediaType] : undefined);
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
