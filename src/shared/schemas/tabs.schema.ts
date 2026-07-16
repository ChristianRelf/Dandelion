import { z } from 'zod';
import { zId, zUrl, zTabGroupColor } from './common';

export const createTabInput = z.object({
  workspaceId: zId,
  url: zUrl.optional(),
  groupId: zId.nullish(),
  index: z.number().int().nonnegative().optional(),
  active: z.boolean().default(true),
  openerTabId: zId.nullish(),
  windowId: zId.optional(),
});
export type CreateTabInput = z.infer<typeof createTabInput>;

export const tabRef = z.object({ tabId: zId });
export const navigateInput = z.object({ tabId: zId, url: zUrl });
export const goToOffsetInput = z.object({ tabId: zId, offset: z.number().int() });

export const moveTabInput = z.object({
  tabId: zId,
  toIndex: z.number().int().nonnegative(),
  groupId: zId.nullish(),
  workspaceId: zId.optional(),
  windowId: zId.optional(),
});
export const reorderTabsInput = z.object({
  workspaceId: zId,
  orderedTabIds: z.array(zId),
});

export const setMutedInput = z.object({ tabId: zId, muted: z.boolean() });
export const setPinnedInput = z.object({ tabId: zId, pinned: z.boolean() });

export const createGroupInput = z.object({
  workspaceId: zId,
  name: z.string().max(120).default(''),
  color: zTabGroupColor,
  tabIds: z.array(zId).default([]),
});
export const updateGroupInput = z.object({
  groupId: zId,
  name: z.string().max(120).optional(),
  color: zTabGroupColor.optional(),
  collapsed: z.boolean().optional(),
});
export const groupRef = z.object({ groupId: zId });

export const splitViewInput = z.object({
  windowId: zId,
  tabIds: z.array(zId).min(2),
  orientation: z.enum(['horizontal', 'vertical']).default('vertical'),
});

export const splitRatioInput = z.object({
  windowId: zId,
  /** Share of the content area for the first pane; clamped by the main process. */
  ratio: z.number().gt(0).lt(1),
});

export const findInPageInput = z.object({
  tabId: zId,
  query: z.string(),
  forward: z.boolean().default(true),
  matchCase: z.boolean().default(false),
});
export const stopFindInput = z.object({
  tabId: zId,
  action: z
    .enum(['clearSelection', 'keepSelection', 'activateSelection'])
    .default('clearSelection'),
});
