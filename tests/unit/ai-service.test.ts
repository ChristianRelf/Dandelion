import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: { isEncryptionAvailable: () => false, encryptString: () => Buffer.from('') },
}));

const { AIService } = await import('@main/services/ai/ai.service');
import type { PageContext } from '@main/services/ai/ai.service';
import type { BrowserEvent } from '@shared/types';
import type { Repositories } from '@main/storage';
import type { EventBus } from '@main/core/event-bus';
import type { Logger } from '@main/core/logger';
import type { SettingsService } from '@main/services/settings.service';

/** Records what reached the bus, so "emitted nothing" is assertable. */
function makeService(options: { keys?: Record<string, string>; page?: PageContext | null } = {}) {
  const store = new Map<string, string>(Object.entries(options.keys ?? {}));
  const emitted: BrowserEvent[] = [];

  const repos = {
    kv: {
      get: <T,>(key: string, fallback: T) => (store.get(key) ?? fallback) as T,
      set: (key: string, value: string) => store.set(key, value),
      remove: (key: string) => store.delete(key),
    },
  } as unknown as Repositories;

  const settings = {
    get: () => ({ ai: { defaultProvider: 'openai', endpoints: {} } }),
    update: () => {},
  } as unknown as SettingsService;

  const service = new AIService(
    repos,
    { emit: (event: BrowserEvent) => emitted.push(event) } as unknown as EventBus,
    settings,
    { info: () => {}, warn: () => {}, error: () => {} } as unknown as Logger,
    () => Promise.resolve(options.page ?? null),
  );

  return { service, emitted };
}

describe('AIService — failures known before the stream exists', () => {
  // The defect: these emitted a terminal `ai:chunk` and returned a requestId.
  // `emitChunk` runs inside the still-executing `ipcMain.handle`, so the chunk
  // reached the renderer *before* the reply carrying the requestId it needed to
  // match — the guard dropped it, and `busy` was never cleared. The chat then
  // refused every further message, because `send()` early-returns on `busy`.
  // Deterministic, not racy: the renderer's requestId is null until the await
  // resolves, so the comparison can never match.
  it('throws for an unconfigured provider rather than emitting a chunk', () => {
    const { service, emitted } = makeService();
    expect(() =>
      service.complete({
        providerId: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    ).toThrow('OpenAI is not configured');
    expect(emitted).toHaveLength(0);
  });

  it('throws for an unknown provider rather than emitting a chunk', () => {
    const { service, emitted } = makeService();
    expect(() =>
      service.complete({
        providerId: 'nope',
        model: 'x',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    ).toThrow('Unknown provider: nope');
    expect(emitted).toHaveLength(0);
  });

  it('throws when the page has no readable content', async () => {
    const { service, emitted } = makeService({ page: null });
    await expect(service.pageAction('tab_1', 'summarize')).rejects.toThrow(
      'No readable page content',
    );
    expect(emitted).toHaveLength(0);
  });

  // The message is what the user reads: `serializeError` keeps `error.message`
  // for a plain Error and the IPC link rebuilds it into a TRPCClientError, so
  // the store's catch surfaces this verbatim rather than "Request failed".
  it('names the provider in the message the renderer will show', () => {
    const { service } = makeService();
    expect(() =>
      service.complete({
        providerId: 'anthropic',
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    ).toThrow(/Anthropic/);
  });
});

describe('AIService.configure', () => {
  // Nothing else can tell a live renderer: `configured` is derived in main from
  // the stored key, so a sidebar opened before the key was saved stayed
  // "Assistant unavailable" until a reload — behind a "key saved" toast.
  it('announces the new provider state when a key is saved', () => {
    const { service, emitted } = makeService();
    service.configure('openai', 'sk-test');

    const event = emitted.find((item) => item.type === 'ai:providers');
    expect(event).toBeDefined();
    expect(
      event?.type === 'ai:providers' &&
        event.providers.find((provider) => provider.id === 'openai')?.configured,
    ).toBe(true);
  });

  it('announces it again when the key is cleared', () => {
    const { service, emitted } = makeService({ keys: { 'ai.key.openai': 'stored' } });
    service.configure('openai', '');

    const event = emitted.at(-1);
    expect(
      event?.type === 'ai:providers' &&
        event.providers.find((provider) => provider.id === 'openai')?.configured,
    ).toBe(false);
  });
});
