import { describe, expect, it, vi } from 'vitest';

/**
 * A keychain whose availability the tests flip, as a Linux keyring does across
 * a restart. `encryptString` produces bytes that only `decryptString` reads
 * back — and that `toString('utf8')` happily turns into garbage rather than
 * throwing, which is the whole defect.
 */
const keychain = vi.hoisted(() => {
  const MAGIC = 'ciphertext:';
  return {
    available: true,
    encrypt: (value: string) => Buffer.from(MAGIC + value, 'utf8'),
    decrypt: (buffer: Buffer) => {
      const text = buffer.toString('utf8');
      if (!text.startsWith(MAGIC)) throw new Error('not ciphertext');
      return text.slice(MAGIC.length);
    },
  };
});

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => keychain.available,
    encryptString: (value: string) => keychain.encrypt(value),
    decryptString: (buffer: Buffer) => keychain.decrypt(buffer),
  },
}));

const { AIService } = await import('@main/services/ai/ai.service');
import type { BrowserEvent } from '@shared/types';
import type { Repositories } from '@main/storage';
import type { EventBus } from '@main/core/event-bus';
import type { Logger } from '@main/core/logger';
import type { SettingsService } from '@main/services/settings.service';

const KEY = 'ai.key.openai';
const API_KEY = 'sk-not-a-real-key';

/** The kv store outlives the service, as the database does across a restart. */
function makeService(stored: Map<string, string> = new Map()) {
  const warnings: string[] = [];

  const repos = {
    kv: {
      get: <T>(key: string, fallback: T) => (stored.get(key) ?? fallback) as T,
      set: (key: string, value: string) => stored.set(key, value),
      remove: (key: string) => stored.delete(key),
    },
  } as unknown as Repositories;

  const service = new AIService(
    repos,
    { emit: (_event: BrowserEvent) => {} } as unknown as EventBus,
    {
      get: () => ({ ai: { defaultProvider: 'openai', endpoints: {} } }),
      update: () => {},
    } as unknown as SettingsService,
    {
      info: () => {},
      warn: (message: string) => warnings.push(message),
      error: () => {},
    } as unknown as Logger,
    () => Promise.resolve(null),
  );

  return { service, stored, warnings };
}

describe('AIService — stored key encoding', () => {
  it('records that a key was encrypted, and reads it back', () => {
    keychain.available = true;
    const { service, stored } = makeService();
    service.configure('openai', API_KEY);

    expect(stored.get(KEY)).toMatch(/^safeStorage:v1:/);
    expect(service.isConfigured('openai')).toBe(true);
  });

  it('records that a key was stored in the clear, and reads it back', () => {
    keychain.available = false;
    const { service, stored } = makeService();
    service.configure('openai', API_KEY);

    expect(stored.get(KEY)).toMatch(/^plain:v1:/);
    expect(service.isConfigured('openai')).toBe(true);
  });

  it('stores a blob that decodes back to the key it was given', () => {
    keychain.available = true;
    const { stored, service } = makeService();
    service.configure('openai', API_KEY);

    const blob = stored.get(KEY)!.slice('safeStorage:v1:'.length);
    expect(keychain.decrypt(Buffer.from(blob, 'base64'))).toBe(API_KEY);
  });

  // The defect. Written with the keychain up, read with it down — a keyring not
  // yet unlocked, which survives restarts — `buffer.toString('utf8')` returned
  // binary garbage instead of throwing, and that garbage was sent as the API
  // key. The result was an opaque 401 from a provider the settings page still
  // reported as configured.
  it('refuses an encrypted key when the keychain is unavailable', () => {
    keychain.available = true;
    const { service, stored } = makeService();
    service.configure('openai', API_KEY);

    keychain.available = false;
    const { service: restarted, warnings } = makeService(stored);

    expect(restarted.isConfigured('openai')).toBe(false);
    expect(warnings.join(' ')).toContain('keychain is unavailable');
    expect(() =>
      restarted.complete({
        providerId: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    ).toThrow('not configured');
  });

  // The reverse order: written in the clear, read with the keychain up. The
  // marker is what stops this being decrypted as though it were ciphertext.
  it('reads a plaintext key once the keychain becomes available', () => {
    keychain.available = false;
    const { service, stored } = makeService();
    service.configure('openai', API_KEY);

    keychain.available = true;
    expect(makeService(stored).service.isConfigured('openai')).toBe(true);
  });
});

describe('AIService — keys stored before the markers existed', () => {
  /** What `configure` wrote before this fix: bare base64, either way. */
  function legacy(stored: Map<string, string>, encrypted: boolean) {
    stored.set(
      KEY,
      encrypted
        ? keychain.encrypt(API_KEY).toString('base64')
        : Buffer.from(API_KEY, 'utf8').toString('base64'),
    );
  }

  it('reads a legacy encrypted key and marks it', () => {
    keychain.available = true;
    const stored = new Map<string, string>();
    legacy(stored, true);

    expect(makeService(stored).service.isConfigured('openai')).toBe(true);
    expect(stored.get(KEY)).toMatch(/^safeStorage:v1:/);
  });

  it('reads a legacy plaintext key and marks it', () => {
    keychain.available = true;
    const stored = new Map<string, string>();
    legacy(stored, false);

    expect(makeService(stored).service.isConfigured('openai')).toBe(true);
    expect(stored.get(KEY)).toMatch(/^safeStorage:v1:/);
  });

  // Unmarked and no keychain to test it against: there is genuinely no way to
  // know whether these bytes are a key or ciphertext, so it says so rather than
  // hand binary to a provider.
  it('refuses an unmarked key when the keychain is unavailable', () => {
    keychain.available = false;
    const stored = new Map<string, string>();
    legacy(stored, true);

    const { service, warnings } = makeService(stored);
    expect(service.isConfigured('openai')).toBe(false);
    expect(warnings.join(' ')).toContain('re-enter the key');
  });
});
