import { z } from 'zod';
import { zHexColor, zId } from './common';

const wallpaperSchema = z.object({
  kind: z.enum(['color', 'gradient', 'image']),
  value: z.string(),
  blur: z.number().min(0).max(100),
  dim: z.number().min(0).max(1),
});

export const createWorkspaceInput = z.object({
  profileId: zId,
  name: z.string().min(1).max(80),
  icon: z.string().default('sparkles'),
  accentColor: zHexColor,
});
export const updateWorkspaceInput = z.object({
  workspaceId: zId,
  name: z.string().min(1).max(80).optional(),
  icon: z.string().optional(),
  accentColor: zHexColor.optional(),
  wallpaper: wallpaperSchema.nullable().optional(),
});
export const workspaceRef = z.object({ workspaceId: zId });
export const reorderWorkspacesInput = z.object({ orderedIds: z.array(zId) });

export const createProfileInput = z.object({
  name: z.string().min(1).max(80),
  color: zHexColor,
  avatar: z.string().nullable().default(null),
  isPrivate: z.boolean().default(false),
});
export const updateProfileInput = z.object({
  profileId: zId,
  name: z.string().min(1).max(80).optional(),
  color: zHexColor.optional(),
  avatar: z.string().nullable().optional(),
});
export const profileRef = z.object({ profileId: zId });
