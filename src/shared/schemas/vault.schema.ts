import { z } from 'zod';
import { zId } from './common';

export const vaultRef = z.object({ profileId: zId });

export const initVaultInput = z.object({
  profileId: zId,
  masterPassword: z.string().min(1),
});
export const unlockVaultInput = z.object({
  profileId: zId,
  masterPassword: z.string().min(1),
});

export const savePasswordInput = z.object({
  profileId: zId,
  origin: z.string().min(1),
  username: z.string(),
  password: z.string().min(1),
  note: z.string().nullable().default(null),
});
export const updatePasswordInput = z.object({
  entryId: zId,
  username: z.string().optional(),
  password: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
});
export const passwordRef = z.object({ entryId: zId });
export const revealPasswordInput = z.object({ entryId: zId });
export const listPasswordsInput = z.object({ profileId: zId, origin: z.string().optional() });

export const generatePasswordInput = z.object({
  length: z.number().int().min(4).max(128).default(20),
  uppercase: z.boolean().default(true),
  lowercase: z.boolean().default(true),
  numbers: z.boolean().default(true),
  symbols: z.boolean().default(true),
  avoidAmbiguous: z.boolean().default(true),
});
