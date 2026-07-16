import type { PasswordEntryId, ProfileId } from './ids';

/**
 * A stored credential. The password is held only as ciphertext produced by the
 * main-process vault; plaintext exists transiently and is returned across IPC
 * only in response to an explicit, unlocked reveal/autofill request.
 */
export interface PasswordEntry {
  id: PasswordEntryId;
  profileId: ProfileId;
  origin: string;
  username: string;
  /** Base64 ciphertext. Never contains plaintext. */
  passwordCipher: string;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

/** The transient decrypted form of a credential. */
export interface DecryptedPassword {
  id: PasswordEntryId;
  origin: string;
  username: string;
  password: string;
}

export type VaultStatus = 'uninitialised' | 'locked' | 'unlocked';

export interface VaultState {
  status: VaultStatus;
  /** Whether OS-level encryption (Electron `safeStorage`) backs the vault key. */
  hardwareBacked: boolean;
  entryCount: number;
  /** Auto-lock timeout in minutes (0 = never). */
  autoLockMinutes: number;
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  /** Exclude visually ambiguous characters (O/0, l/1, …). */
  avoidAmbiguous: boolean;
}

/** A weak/reused/breached-credential audit finding. */
export interface PasswordAuditIssue {
  entryId: PasswordEntryId;
  kind: 'weak' | 'reused' | 'old';
  detail: string;
}
