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
  }

  complete(request: AiCompletionRequest): string {
    const requestId = createId('ai');
    const provider = this.providers.get(request.providerId);
    if (!provider) {
      this.emitChunk(requestId, '', true, `Unknown provider: ${request.providerId}`);
      return requestId;
    }
    const apiKey = provider.requiresApiKey ? this.getKey(request.providerId) : '';
    if (provider.requiresApiKey && !apiKey) {
      this.emitChunk(requestId, '', true, `${provider.name} is not configured`);
      return requestId;
    }

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

  async pageAction(tabId: string, task: AiTask, targetLanguage = 'English'): Promise<string> {
    const context = await this.pageContext(tabId);
    const requestId = createId('ai');
    if (!context) {
      this.emitChunk(requestId, '', true, 'No readable page content');
      return requestId;
    }
    const template = BUILTIN_PROMPTS.find((prompt) => prompt.task === task) ?? BUILTIN_PROMPTS[0]!;
    const prompt = template.template
      .replace('{{content}}', context.text)
      .replace('{{url}}', context.url)
      .replace('{{title}}', context.title)
      .replace('{{language}}', targetLanguage);

    const providerId = this.settings.get().ai.defaultProvider;
    const provider = this.providers.get(providerId);
    return this.complete({
      providerId,
      model: provider?.models[0]?.id ?? '',
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
