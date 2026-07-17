import { safeStorage } from 'electron';
import type { AiCompletionRequest, AiProviderInfo, AiTask, PromptTemplate } from '@shared/types';
import { createId } from '@shared/utils';
import type { Repositories } from '../../storage';
import type { EventBus } from '../../core/event-bus';
import type { Logger } from '../../core/logger';
import type { SettingsService } from '../settings.service';
import type { AiProvider } from './provider';
import { createProviders } from './providers';

export interface PageContext {
  url: string;
  title: string;
  text: string;
}

export type PageContextProvider = (tabId: string) => Promise<PageContext | null>;

const KEY_PREFIX = 'ai.key.';
const PROMPTS_KEY = 'ai.customPrompts';

const BUILTIN_PROMPTS: PromptTemplate[] = [
  {
    id: 'builtin-summarize',
    name: 'Summarise page',
    description: 'A concise summary of the current page',
    task: 'summarize',
    builtIn: true,
    template:
      'Summarise the following web page in 5 concise bullet points.\n\nTitle: {{title}}\nURL: {{url}}\n\n{{content}}',
  },
  {
    id: 'builtin-explain',
    name: 'Explain page',
    description: 'Explain the page simply',
    task: 'explain',
    builtIn: true,
    template:
      'Explain the following web page in plain language for a curious non-expert.\n\nTitle: {{title}}\n\n{{content}}',
  },
  {
    id: 'builtin-translate',
    name: 'Translate page',
    description: 'Translate the page',
    task: 'translate',
    builtIn: true,
    template:
      'Translate the following text into {{language}}. Preserve meaning and tone.\n\n{{content}}',
  },
];

/**
 * Orchestrates AI providers: stores credentials encrypted with the OS keychain
 * (`safeStorage`), streams completions to the renderer as `ai:chunk` events, and
 * powers page summarise/explain/translate actions and the prompt library.
 *
 * No API keys ship with the app; a provider is "configured" only once a key is
 * supplied in settings.
 */
export class AIService {
  private readonly providers = new Map<string, AiProvider>();
  private readonly active = new Map<string, AbortController>();

  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
    private readonly settings: SettingsService,
    private readonly logger: Logger,
    private readonly pageContext: PageContextProvider,
  ) {
    for (const provider of createProviders()) this.providers.set(provider.id, provider);
  }

  listProviders(): AiProviderInfo[] {
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      name: provider.name,
      models: provider.models,
      requiresApiKey: provider.requiresApiKey,
      baseUrlConfigurable: provider.baseUrlConfigurable,
      configured: this.isConfigured(provider.id),
    }));
  }

  isConfigured(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return false;
    if (!provider.requiresApiKey) return true;
    return this.getKey(providerId) !== null;
  }

  configure(providerId: string, apiKey?: string, baseUrl?: string): void {
    if (apiKey !== undefined) {
      if (apiKey === '') {
        this.repos.kv.remove(`${KEY_PREFIX}${providerId}`);
      } else {
        const stored = safeStorage.isEncryptionAvailable()
          ? safeStorage.encryptString(apiKey).toString('base64')
          : Buffer.from(apiKey, 'utf8').toString('base64');
        this.repos.kv.set(`${KEY_PREFIX}${providerId}`, stored);
      }
    }
    if (baseUrl !== undefined) {
      const endpoints = { ...this.settings.get().ai.endpoints, [providerId]: baseUrl };
      this.settings.update({ ai: { endpoints } });
    }
    // `configured` is derived in main from the stored key, so only main can know
    // it changed. Without this a sidebar opened before the key was saved stays
    // "Assistant unavailable" until the renderer reloads — behind a toast saying
    // the key was saved.
    this.events.emit({ type: 'ai:providers', providers: this.listProviders() });
  }

  /**
   * Starts a streaming completion and returns the id its chunks will carry.
   *
   * Anything knowable before the stream exists **throws** rather than emitting a
   * terminal chunk. A chunk emitted here would be sent inside the still-running
   * `ipcMain.handle` call, so it would reach the renderer before the reply
   * carrying the `requestId` needed to match it — and be dropped, leaving the
   * chat busy forever. These are failures of the call, not events in a stream.
   */
  complete(request: AiCompletionRequest): string {
    const provider = this.providers.get(request.providerId);
    if (!provider) throw new Error(`Unknown provider: ${request.providerId}`);

    const apiKey = provider.requiresApiKey ? this.getKey(request.providerId) : '';
    if (provider.requiresApiKey && !apiKey) throw new Error(`${provider.name} is not configured`);

    const requestId = createId('ai');
    const controller = new AbortController();
    this.active.set(requestId, controller);
    const baseUrl = this.settings.get().ai.endpoints[request.providerId] ?? null;

    void provider
      .complete({
        apiKey: apiKey ?? '',
        baseUrl,
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        signal: controller.signal,
        onDelta: (text) => this.emitChunk(requestId, text, false, null),
      })
      .then(() => this.emitChunk(requestId, '', true, null))
      .catch((error: unknown) =>
        this.emitChunk(
          requestId,
          '',
          true,
          error instanceof Error ? error.message : 'AI request failed',
        ),
      )
      .finally(() => this.active.delete(requestId));

    return requestId;
  }

  cancel(requestId: string): void {
    this.active.get(requestId)?.abort();
    this.active.delete(requestId);
  }

  async pageAction(
    tabId: string,
    task: AiTask,
    targetLanguage = 'English',
    override?: { providerId?: string; model?: string },
  ): Promise<string> {
    const context = await this.pageContext(tabId);
    // Throws for the same reason `complete` does: there is no stream yet to
    // carry the failure, and the renderer cannot match a chunk for a request it
    // has not been told the id of.
    if (!context) throw new Error('No readable page content');
    const template = BUILTIN_PROMPTS.find((prompt) => prompt.task === task) ?? BUILTIN_PROMPTS[0]!;
    const prompt = template.template
      .replace('{{content}}', context.text)
      .replace('{{url}}', context.url)
      .replace('{{title}}', context.title)
      .replace('{{language}}', targetLanguage);

    // Honour the picker when the caller sent one; the default provider and its
    // first model are the fallback, not the rule.
    const providerId = override?.providerId ?? this.settings.get().ai.defaultProvider;
    const provider = this.providers.get(providerId);
    return this.complete({
      providerId,
      model: override?.model || (provider?.models[0]?.id ?? ''),
      messages: [
        {
          role: 'system',
          content: 'You are Dandelion, a concise and helpful in-browser assistant.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      stream: true,
    });
  }

  listPrompts(): PromptTemplate[] {
    return [...BUILTIN_PROMPTS, ...this.repos.kv.get<PromptTemplate[]>(PROMPTS_KEY, [])];
  }

  savePrompt(input: Omit<PromptTemplate, 'id' | 'builtIn'>): PromptTemplate {
    const prompt: PromptTemplate = { ...input, id: createId('prompt'), builtIn: false };
    const custom = this.repos.kv.get<PromptTemplate[]>(PROMPTS_KEY, []);
    custom.push(prompt);
    this.repos.kv.set(PROMPTS_KEY, custom);
    return prompt;
  }

  deletePrompt(id: string): void {
    const custom = this.repos.kv
      .get<PromptTemplate[]>(PROMPTS_KEY, [])
      .filter((prompt) => prompt.id !== id);
    this.repos.kv.set(PROMPTS_KEY, custom);
  }

  private getKey(providerId: string): string | null {
    const stored = this.repos.kv.get<string | null>(`${KEY_PREFIX}${providerId}`, null);
    if (!stored) return null;
    try {
      const buffer = Buffer.from(stored, 'base64');
      return safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buffer)
        : buffer.toString('utf8');
    } catch {
      this.logger.warn(`failed to decrypt AI key for ${providerId}`);
      return null;
    }
  }

  private emitChunk(requestId: string, delta: string, done: boolean, error: string | null): void {
    this.events.emit({ type: 'ai:chunk', chunk: { requestId, delta, done, error } });
  }
}
