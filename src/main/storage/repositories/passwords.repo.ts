import type { PasswordEntry } from '@shared/types';
import type { SqliteDatabase } from '../database';
import { updateColumns } from './helpers';

export interface VaultMeta {
  profileId: string;
  salt: string;
  verifier: string;
  wrappedKey: string;
  createdAt: number;
  updatedAt: number;
}

interface PasswordRow {
  id: string;
  profile_id: string;
  origin: string;
  username: string;
  password_cipher: string;
  note: string | null;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
}

interface VaultMetaRow {
  profile_id: string;
  salt: string;
  verifier: string;
  wrapped_key: string;
  created_at: number;
  updated_at: number;
}

const toEntry = (row: PasswordRow): PasswordEntry => ({
  id: row.id,
  profileId: row.profile_id,
  origin: row.origin,
  username: row.username,
  passwordCipher: row.password_cipher,
  note: row.note,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastUsedAt: row.last_used_at,
});

export class PasswordsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /* ---- Vault metadata (master key material) ---- */

  getVaultMeta(profileId: string): VaultMeta | null {
    const row = this.db.prepare('SELECT * FROM vault_meta WHERE profile_id = ?').get(profileId) as
      VaultMetaRow | undefined;
    if (!row) return null;
    return {
      profileId: row.profile_id,
      salt: row.salt,
      verifier: row.verifier,
      wrappedKey: row.wrapped_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  upsertVaultMeta(meta: VaultMeta): void {
    this.db
      .prepare(
        `INSERT INTO vault_meta (profile_id, salt, verifier, wrapped_key, created_at, updated_at)
         VALUES (@profile_id, @salt, @verifier, @wrapped_key, @created_at, @updated_at)
         ON CONFLICT(profile_id) DO UPDATE SET
           salt = excluded.salt,
           verifier = excluded.verifier,
           wrapped_key = excluded.wrapped_key,
           updated_at = excluded.updated_at`,
      )
      .run({
        profile_id: meta.profileId,
        salt: meta.salt,
        verifier: meta.verifier,
        wrapped_key: meta.wrappedKey,
        created_at: meta.createdAt,
        updated_at: meta.updatedAt,
      });
  }

  /* ---- Credential entries (ciphertext only) ---- */

  list(profileId: string, origin?: string): PasswordEntry[] {
    const rows = origin
      ? (this.db
          .prepare(
            'SELECT * FROM passwords WHERE profile_id = ? AND origin = ? ORDER BY origin, username',
          )
          .all(profileId, origin) as PasswordRow[])
      : (this.db
          .prepare('SELECT * FROM passwords WHERE profile_id = ? ORDER BY origin, username')
          .all(profileId) as PasswordRow[]);
    return rows.map(toEntry);
  }

  get(id: string): PasswordEntry | null {
    const row = this.db.prepare('SELECT * FROM passwords WHERE id = ?').get(id) as
      PasswordRow | undefined;
    return row ? toEntry(row) : null;
  }

  findByOriginUsername(profileId: string, origin: string, username: string): PasswordEntry | null {
    const row = this.db
      .prepare('SELECT * FROM passwords WHERE profile_id = ? AND origin = ? AND username = ?')
      .get(profileId, origin, username) as PasswordRow | undefined;
    return row ? toEntry(row) : null;
  }

  insert(entry: PasswordEntry): void {
    this.db
      .prepare(
        `INSERT INTO passwords
           (id, profile_id, origin, username, password_cipher, note, created_at, updated_at, last_used_at)
         VALUES (@id, @profile_id, @origin, @username, @password_cipher, @note, @created_at, @updated_at, @last_used_at)`,
      )
      .run({
        id: entry.id,
        profile_id: entry.profileId,
        origin: entry.origin,
        username: entry.username,
        password_cipher: entry.passwordCipher,
        note: entry.note,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
        last_used_at: entry.lastUsedAt,
      });
  }

  update(
    id: string,
    patch: Partial<Pick<PasswordEntry, 'username' | 'passwordCipher' | 'note' | 'lastUsedAt'>>,
  ): void {
    updateColumns(this.db, 'passwords', id, {
      username: patch.username,
      password_cipher: patch.passwordCipher,
      note: patch.note,
      last_used_at: patch.lastUsedAt,
      updated_at: Date.now(),
    });
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM passwords WHERE id = ?').run(id);
  }

  count(profileId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM passwords WHERE profile_id = ?')
      .get(profileId) as { n: number };
    return row.n;
  }
}
