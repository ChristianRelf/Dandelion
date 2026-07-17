import { dialog, type Session } from 'electron';
import type { ProfileService } from './profile.service';
import type { SessionManager } from '../browser/session-manager';
import type { Logger } from '../core/logger';

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

/**
 * Chrome extension management on top of Electron's extension API. Manifest V3
 * unpacked extensions can be loaded into the default profile's session; support
 * tracks Chromium's own MV3 coverage.
 */
export class ExtensionsService {
  /** Extensions the user has toggled off: unloaded from the session but kept so
   * they can be reloaded from their original path. */
  private readonly disabled = new Map<string, { name: string; version: string; path: string }>();

  constructor(
    private readonly sessions: SessionManager,
    private readonly profiles: ProfileService,
    private readonly logger: Logger,
  ) {}

  private session(): Session | null {
    const profile = this.profiles.getDefault();
    return profile ? this.sessions.getSession(profile) : null;
  }

  list(): ExtensionInfo[] {
    const session = this.session();
    const loaded = session
      ? session.extensions.getAllExtensions().map((extension) => ({
          id: extension.id,
          name: extension.name,
          version: extension.version,
          enabled: true,
        }))
      : [];
    const off = [...this.disabled.entries()].map(([id, entry]) => ({
      id,
      name: entry.name,
      version: entry.version,
      enabled: false,
    }));
    return [...loaded, ...off];
  }

  /** Enable or disable an extension by unloading/reloading it in the session. */
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const session = this.session();
    if (!session) return;
    if (enabled) {
      const entry = this.disabled.get(id);
      if (!entry) return;
      try {
        await session.extensions.loadExtension(entry.path, { allowFileAccess: true });
        this.disabled.delete(id);
      } catch (error) {
        this.logger.warn('failed to enable extension', error);
      }
    } else {
      const extension = session.extensions.getAllExtensions().find((item) => item.id === id);
      if (!extension) return;
      this.disabled.set(id, {
        name: extension.name,
        version: extension.version,
        path: extension.path,
      });
      session.extensions.removeExtension(id);
    }
  }

  async loadUnpacked(): Promise<ExtensionInfo | null> {
    const session = this.session();
    if (!session) return null;
    const result = await dialog.showOpenDialog({
      title: 'Select an unpacked extension folder',
      properties: ['openDirectory'],
    });
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;
    try {
      const extension = await session.extensions.loadExtension(path, { allowFileAccess: true });
      return { id: extension.id, name: extension.name, version: extension.version, enabled: true };
    } catch (error) {
      this.logger.warn('failed to load extension', error);
      return null;
    }
  }

  remove(id: string): void {
    this.session()?.extensions.removeExtension(id);
    // `list()` unions the session's extensions with `disabled`, so a disabled
    // one is unloaded and `removeExtension` no-ops for it — leaving the entry
    // here to resurrect it on every list, forever, with no way to get rid of it.
    this.disabled.delete(id);
  }
}
