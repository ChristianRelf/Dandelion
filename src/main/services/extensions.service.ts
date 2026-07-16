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
    if (!session) return [];
    return session.extensions.getAllExtensions().map((extension) => ({
      id: extension.id,
      name: extension.name,
      version: extension.version,
      enabled: true,
    }));
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
  }
}
