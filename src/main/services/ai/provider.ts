import type { AiMessage, AiModel, AiProviderId } from '@shared/types';

export interface CompleteOptions {
  apiKey: string;
  baseUrl: string | null;
  model: string;
  messages: AiMessage[];
  temperature: number;
  signal: AbortSignal;
  onDelta: (text: string) => void;
}

/**
 * The contract every AI backend implements. Providers are stateless — the
 * {@link AiService} supplies credentials per call — so adding a new backend is
 * a matter of implementing `complete` and registering the provider.
 */
export interface AiProvider {
  readonly id: AiProviderId;
  readonly name: string;
  readonly models: AiModel[];
  readonly requiresApiKey: boolean;
  readonly baseUrlConfigurable: boolean;
  readonly defaultBaseUrl: string;
  complete(options: CompleteOptions): Promise<void>;
}

/** Parse a `text/event-stream` body, invoking `onData` for each `data:` line. */
export async function readEventStream(
  response: Response,
  onData: (data: string) => void,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.startsWith('data:')) onData(line.slice(5).trim());
      newlineIndex = buffer.indexOf('\n');
    }
  }
}
