import { z } from 'zod';
import { zId } from './common';

export const aiRole = z.enum(['system', 'user', 'assistant']);
export const aiMessage = z.object({ role: aiRole, content: z.string() });

export const aiCompleteInput = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  messages: z.array(aiMessage).min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  task: z.enum(['chat', 'summarize', 'explain', 'translate']).default('chat'),
});

export const aiConfigureInput = z.object({
  providerId: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

export const aiPageActionInput = z.object({
  tabId: zId,
  task: z.enum(['summarize', 'explain', 'translate']),
  targetLanguage: z.string().optional(),
  /** From the sidebar's picker. Falls back to the default provider's first model. */
  providerId: z.string().optional(),
  model: z.string().optional(),
});

export const promptTemplateInput = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  template: z.string().min(1),
  task: z.enum(['chat', 'summarize', 'explain', 'translate']).default('chat'),
});
