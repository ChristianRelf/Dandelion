import type { PromptTemplateId } from './ids';

export type AiProviderId = 'openai' | 'anthropic' | 'google' | 'local' | (string & {});

export interface AiModel {
  id: string;
  name: string;
  contextWindow: number;
  supportsStreaming: boolean;
}

export interface AiProviderInfo {
  id: AiProviderId;
  name: string;
  models: AiModel[];
  requiresApiKey: boolean;
  baseUrlConfigurable: boolean;
  /** Whether credentials/endpoint have been supplied for this provider. */
  configured: boolean;
}

export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export type AiTask = 'chat' | 'summarize' | 'explain' | 'translate';

/**
 * A reusable prompt. Supports the placeholders `{{selection}}`, `{{url}}`,
 * `{{title}}`, `{{content}}` and `{{language}}`, substituted from page context.
 */
export interface PromptTemplate {
  id: PromptTemplateId;
  name: string;
  description: string;
  template: string;
  task: AiTask;
  builtIn: boolean;
}

export interface AiCompletionRequest {
  providerId: AiProviderId;
  model: string;
  messages: AiMessage[];
  temperature: number;
  stream: boolean;
}

export interface AiStreamChunk {
  requestId: string;
  delta: string;
  done: boolean;
  error: string | null;
}
