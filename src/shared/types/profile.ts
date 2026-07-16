import type { ProfileId } from './ids';

/**
 * A browser profile: the true storage and security boundary. Each profile maps
 * to a dedicated Electron `session` partition, which isolates cookies, cache,
 * local storage, the password vault, site permissions and installed extensions.
 */
export interface Profile {
  id: ProfileId;
  name: string;
  /** Avatar background colour (hex). */
  color: string;
  /** Emoji or image path shown as the profile avatar. */
  avatar: string | null;
  /**
   * Electron session partition string, e.g. `persist:dandelion-<id>`. Private
   * profiles use a non-`persist:` partition so nothing is written to disk.
   */
  partition: string;
  isDefault: boolean;
  /** Ephemeral (incognito) profile — storage is discarded when the last window closes. */
  isPrivate: boolean;
  createdAt: number;
  updatedAt: number;
}
