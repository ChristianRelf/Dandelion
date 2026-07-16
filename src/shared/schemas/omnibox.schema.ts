import { z } from 'zod';
import { zId } from './common';

export const omniboxQueryInput = z.object({
  input: z.string(),
  cursor: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(20).default(10),
  profileId: zId.optional(),
  workspaceId: zId.optional(),
});

export const setDefaultEngineInput = z.object({ engineId: zId });
export const addSearchEngineInput = z.object({
  name: z.string().min(1),
  keyword: z.string().min(1).max(12),
  searchUrl: z.string().includes('%s'),
  suggestUrl: z.string().nullable().default(null),
});
export const searchEngineRef = z.object({ engineId: zId });
