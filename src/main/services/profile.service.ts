import type { Profile } from '@shared/types';
import { appError, type Result, err, ok } from '@shared/types';
import { createId, createShortId } from '@shared/utils';
import type { Repositories } from '../storage';

export interface CreateProfileInput {
  name: string;
  color: string;
  avatar: string | null;
  isPrivate: boolean;
}

/**
 * Manages browser profiles — the storage/security boundary. Each profile owns an
 * Electron session partition; persistent profiles use `persist:` partitions,
 * private profiles use in-memory partitions that vanish on exit.
 */
export class ProfileService {
  constructor(private readonly repos: Repositories) {}

  /** Guarantee a default profile exists (first run) and return it. */
  ensureDefault(): Profile {
    const existing = this.repos.profiles.getDefault();
    if (existing) return existing;

    const now = Date.now();
    const profile: Profile = {
      id: createId('profile'),
      name: 'Personal',
      color: '#f5c451',
      avatar: '🌼',
      partition: `persist:dandelion-${createShortId()}`,
      isDefault: true,
      isPrivate: false,
      createdAt: now,
      updatedAt: now,
    };
    this.repos.profiles.insert(profile);
    return profile;
  }

  /** Return the shared private (incognito) profile, creating it on first use. */
  ensurePrivate(): Profile {
    const existing = this.repos.profiles.list().find((profile) => profile.isPrivate);
    if (existing) return existing;
    return this.create({ name: 'Private', color: '#8b8b93', avatar: '🕶️', isPrivate: true });
  }

  list(): Profile[] {
    return this.repos.profiles.list();
  }

  get(id: string): Profile | null {
    return this.repos.profiles.get(id);
  }

  getDefault(): Profile | null {
    return this.repos.profiles.getDefault();
  }

  create(input: CreateProfileInput): Profile {
    const now = Date.now();
    const suffix = createShortId();
    const profile: Profile = {
      id: createId('profile'),
      name: input.name,
      color: input.color,
      avatar: input.avatar,
      partition: input.isPrivate ? `dandelion-private-${suffix}` : `persist:dandelion-${suffix}`,
      isDefault: false,
      isPrivate: input.isPrivate,
      createdAt: now,
      updatedAt: now,
    };
    this.repos.profiles.insert(profile);
    return profile;
  }

  update(id: string, patch: Partial<Pick<Profile, 'name' | 'color' | 'avatar'>>): Result<Profile> {
    const profile = this.repos.profiles.get(id);
    if (!profile) return err(appError('profile/not-found', 'Profile not found'));
    this.repos.profiles.update(id, patch);
    return ok(this.repos.profiles.get(id)!);
  }

  delete(id: string): Result<true> {
    const profile = this.repos.profiles.get(id);
    if (!profile) return err(appError('profile/not-found', 'Profile not found'));
    if (profile.isDefault) {
      return err(appError('profile/protected', 'The default profile cannot be deleted'));
    }
    if (this.repos.profiles.count() <= 1) {
      return err(appError('profile/last', 'At least one profile must remain'));
    }
    this.repos.profiles.delete(id);
    return ok(true);
  }
}
