import type { AiModel, AiProviderId } from '@shared/types';
import { type AiProvider, type CompleteOptions, readEventStream } from './provider';

function extractText(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

/** OpenAI Chat Completions — also serves any OpenAI-compatible endpoint. */
export class OpenAIProvider implements AiProvider {
  readonly id: AiProviderId = 'openai';
  readonly name: string = 'OpenAI';
  readonly models: AiModel[] = [
    { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128_000, supportsStreaming: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', contextWindow: 128_000, supportsStreaming: true },
  ];
  readonly requiresApiKey: boolean = true;
  readonly baseUrlConfigurable: boolean = true;
  readonly defaultBaseUrl: string = 'https://api.openai.com';

  async complete(options: CompleteOptions): Promise<void> {
    const base = options.baseUrl ?? this.defaultBaseUrl;
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature,
        stream: true,
        messages: options.messages,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI error ${response.status}`);
    await readEventStream(response, (data) => {
      if (data === '[DONE]') return;
      try {
        const delta = extractText(JSON.parse(data), ['choices', '0', 'delta', 'content']);
        if (delta) options.onDelta(delta);
      } catch {
        /* ignore malformed chunk */
      }
    });
  }
}

/** A local, OpenAI-compatible endpoint (e.g. Ollama, LM Studio). */
export class LocalProvider extends OpenAIProvider {
  override readonly id = 'local';
  override readonly name = 'Local model';
  override readonly models = [
    { id: 'llama3.1', name: 'Llama 3.1', contextWindow: 128_000, supportsStreaming: true },
  ];
  override readonly requiresApiKey = false;
  override readonly defaultBaseUrl = 'http://localhost:11434';
}

/** Anthropic Messages API. */
export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  readonly models = [
    {
      id: 'claude-sonnet-5',
      name: 'Claude Sonnet 5',
      contextWindow: 200_000,
      supportsStreaming: true,
    },
    {
      id: 'claude-opus-4-8',
      name: 'Claude Opus 4.8',
      contextWindow: 200_000,
      supportsStreaming: true,
    },
  ];
  readonly requiresApiKey = true;
  readonly baseUrlConfigurable = true;
  readonly defaultBaseUrl = 'https://api.anthropic.com';

  async complete(options: CompleteOptions): Promise<void> {
    const base = options.baseUrl ?? this.defaultBaseUrl;
    const system = options.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
    const messages = options.messages.filter((message) => message.role !== 'system');
    const response = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal: options.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: 2048,
        temperature: options.temperature,
        stream: true,
        system: system || undefined,
        messages,
      }),
    });
    if (!response.ok) throw new Error(`Anthropic error ${response.status}`);
    await readEventStream(response, (data) => {
      try {
        const parsed = JSON.parse(data) as { type?: string; delta?: { text?: string } };
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          options.onDelta(parsed.delta.text);
        }
      } catch {
        /* ignore */
      }
    });
  }
}

/** Google Gemini streaming generateContent. */
export class GoogleProvider implements AiProvider {
  readonly id = 'google';
  readonly name = 'Google Gemini';
  readonly models = [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      contextWindow: 1_000_000,
      supportsStreaming: true,
    },
  ];
  readonly requiresApiKey = true;
  readonly baseUrlConfigurable = false;
  readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com';

  async complete(options: CompleteOptions): Promise<void> {
    const url =
      `${this.defaultBaseUrl}/v1beta/models/${options.model}:streamGenerateContent` +
      `?alt=sse&key=${encodeURIComponent(options.apiKey)}`;
    const contents = options.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }));
    const response = await fetch(url, {
      method: 'POST',
      signal: options.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { temperature: options.temperature } }),
    });
    if (!response.ok) throw new Error(`Google error ${response.status}`);
    await readEventStream(response, (data) => {
      try {
        const text = extractText(JSON.parse(data), [
          'candidates',
          '0',
          'content',
          'parts',
          '0',
          'text',
        ]);
        if (text) options.onDelta(text);
      } catch {
        /* ignore */
      }
    });
  }
}

export function createProviders(): AiProvider[] {
  return [new AnthropicProvider(), new OpenAIProvider(), new GoogleProvider(), new LocalProvider()];
}
