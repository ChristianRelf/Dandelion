import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { safeStorage } from 'electron';
import type { PasswordEntry, PasswordGeneratorOptions, Result, VaultState } from '@shared/types';
import { appError, err, ok } from '@shared/types';
import { createId } from '@shared/utils';
import type { Repositories } from '../storage';
import type { VaultMeta } from '../storage';
import type { EventBus } from '../core/event-bus';
import type { Logger } from '../core/logger';

const VERIFIER = Buffer.from('dandelion-vault-verifier-v1', 'utf8');
const AUTO_LOCK_KEY = 'vault.autoLockMinutes';

function deriveKey(password: string, salt: Buffer): Buffer {
  // scrypt with conservative work factors for an interactive unlock.
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function encrypt(key: Buffer, plaintext: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

function decrypt(key: Buffer, payload: string): Buffer {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * An encrypted local password vault. A master password is stretched with scrypt
 * to a key-encryption-key that wraps a random 256-bit data key; credentials are
 * sealed with AES-256-GCM under the data key. The data key exists in memory only
 * while unlocked and is zeroed on lock / auto-lock.
 */
export class VaultService {
  private readonly keys = new Map<string, Buffer>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private autoLockMinutes: number;

  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
    private readonly logger: Logger,
  ) {
    this.autoLockMinutes = this.repos.kv.get<number>(AUTO_LOCK_KEY, 15);
  }

  state(profileId: string): VaultState {
    const meta = this.repos.passwords.getVaultMeta(profileId);
    const status = !meta ? 'uninitialised' : this.keys.has(profileId) ? 'unlocked' : 'locked';
    return {
      status,
      hardwareBacked: safeStorage.isEncryptionAvailable(),
      entryCount: this.repos.passwords.count(profileId),
      autoLockMinutes: this.autoLockMinutes,
    };
  }

  init(profileId: string, masterPassword: string): Result<VaultState> {
    if (this.repos.passwords.getVaultMeta(profileId)) {
      return err(appError('vault/exists', 'Vault already initialised'));
    }
    const salt = randomBytes(16);
    const derived = deriveKey(masterPassword, salt);
    const dataKey = randomBytes(32);
    const now = Date.now();
    const meta: VaultMeta = {
      profileId,
      salt: salt.toString('base64'),
      verifier: encrypt(derived, VERIFIER),
      wrappedKey: encrypt(derived, dataKey),
      createdAt: now,
      updatedAt: now,
    };
    this.repos.passwords.upsertVaultMeta(meta);
    this.keys.set(profileId, dataKey);
    this.scheduleAutoLock(profileId);
    this.emitState(profileId);
    return ok(this.state(profileId));
  }

  unlock(profileId: string, masterPassword: string): Result<VaultState> {
    const meta = this.repos.passwords.getVaultMeta(profileId);
    if (!meta) return err(appError('vault/uninitialised', 'Vault has not been set up'));
    const derived = deriveKey(masterPassword, Buffer.from(meta.salt, 'base64'));
    try {
      const verified = decrypt(derived, meta.verifier);
      if (verified.length !== VERIFIER.length || !timingSafeEqual(verified, VERIFIER)) {
        return err(appError('vault/bad-password', 'Incorrect master password'));
      }
      this.keys.set(profileId, decrypt(derived, meta.wrappedKey));
      this.scheduleAutoLock(profileId);
      this.emitState(profileId);
      return ok(this.state(profileId));
    } catch {
      return err(appError('vault/bad-password', 'Incorrect master password'));
    }
  }

  lock(profileId: string): void {
    const key = this.keys.get(profileId);
    if (key) key.fill(0);
    this.keys.delete(profileId);
    const timer = this.timers.get(profileId);
    if (timer) clearTimeout(timer);
    this.timers.delete(profileId);
    this.emitState(profileId);
  }

  setAutoLockMinutes(minutes: number): void {
    this.autoLockMinutes = Math.max(0, minutes);
    this.repos.kv.set(AUTO_LOCK_KEY, this.autoLockMinutes);
    for (const profileId of this.keys.keys()) this.scheduleAutoLock(profileId);
  }

  list(profileId: string, origin?: string): PasswordEntry[] {
    return this.repos.passwords.list(profileId, origin);
  }

  save(input: {
    profileId: string;
    origin: string;
    username: string;
    password: string;
    note: string | null;
  }): Result<PasswordEntry> {
    const key = this.keys.get(input.profileId);
    if (!key) return err(appError('vault/locked', 'Vault is locked'));

    const cipher = encrypt(key, Buffer.from(input.password, 'utf8'));
    const existing = this.repos.passwords.findByOriginUsername(
      input.profileId,
      input.origin,
      input.username,
    );
    if (existing) {
      this.repos.passwords.update(existing.id, { passwordCipher: cipher, note: input.note });
      return ok(this.repos.passwords.get(existing.id)!);
    }

    const now = Date.now();
    const entry: PasswordEntry = {
      id: createId('pw'),
      profileId: input.profileId,
      origin: input.origin,
      username: input.username,
      passwordCipher: cipher,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: null,
    };
    this.repos.passwords.insert(entry);
    this.emitState(input.profileId);
    return ok(entry);
  }

  update(
    entryId: string,
    patch: { username?: string; password?: string; note?: string | null },
  ): Result<PasswordEntry> {
    const entry = this.repos.passwords.get(entryId);
    if (!entry) return err(appError('vault/not-found', 'Credential not found'));

    const columnPatch: Parameters<Repositories['passwords']['update']>[1] = {
      username: patch.username,
      note: patch.note,
    };
    if (patch.password !== undefined) {
      const key = this.keys.get(entry.profileId);
      if (!key) return err(appError('vault/locked', 'Vault is locked'));
      columnPatch.passwordCipher = encrypt(key, Buffer.from(patch.password, 'utf8'));
    }
    this.repos.passwords.update(entryId, columnPatch);
    return ok(this.repos.passwords.get(entryId)!);
  }

  remove(entryId: string): void {
    const entry = this.repos.passwords.get(entryId);
    this.repos.passwords.remove(entryId);
    if (entry) this.emitState(entry.profileId);
  }

  reveal(entryId: string): Result<string> {
    const entry = this.repos.passwords.get(entryId);
    if (!entry) return err(appError('vault/not-found', 'Credential not found'));
    const key = this.keys.get(entry.profileId);
    if (!key) return err(appError('vault/locked', 'Vault is locked'));
    try {
      const plaintext = decrypt(key, entry.passwordCipher).toString('utf8');
      this.repos.passwords.update(entryId, { lastUsedAt: Date.now() });
      return ok(plaintext);
    } catch {
      return err(appError('vault/corrupt', 'Could not decrypt credential'));
    }
  }

  generate(options: PasswordGeneratorOptions): string {
    let pool = '';
    if (options.lowercase) pool += 'abcdefghijklmnopqrstuvwxyz';
    if (options.uppercase) pool += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (options.numbers) pool += '0123456789';
    if (options.symbols) pool += '!@#$%^&*()-_=+[]{};:,.<>?';
    if (options.avoidAmbiguous) pool = pool.replace(/[O0oIl1|`]/g, '');
    if (!pool) pool = 'abcdefghijklmnopqrstuvwxyz';

    const length = Math.max(4, options.length);
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) out += pool[bytes[i]! % pool.length];
    return out;
  }

  private scheduleAutoLock(profileId: string): void {
    const existing = this.timers.get(profileId);
    if (existing) clearTimeout(existing);
    if (this.autoLockMinutes <= 0) return;
    this.timers.set(
      profileId,
      setTimeout(() => {
        this.logger.info(`vault auto-locked for profile ${profileId}`);
        this.lock(profileId);
      }, this.autoLockMinutes * 60_000),
    );
  }

  private emitState(profileId: string): void {
    this.events.emit({ type: 'vault:state', state: this.state(profileId) });
  }
}
