import { z } from 'zod';
import { zId, zUrl } from './common';

/* Bookmarks */
export const addBookmarkInput = z.object({
  profileId: zId,
  url: zUrl,
  title: z.string().default(''),
  folderId: zId.nullish(),
  workspaceId: zId.nullish(),
  tags: z.array(z.string()).default([]),
  description: z.string().nullable().default(null),
});
export const updateBookmarkInput = z.object({
  bookmarkId: zId,
  title: z.string().optional(),
  url: zUrl.optional(),
  folderId: zId.nullish(),
  tags: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
});
export const bookmarkRef = z.object({ bookmarkId: zId });
export const createFolderInput = z.object({
  profileId: zId,
  name: z.string().min(1),
  parentId: zId.nullish(),
});
export const listBookmarksInput = z.object({
  profileId: zId,
  folderId: zId.nullish(),
  query: z.string().optional(),
});

/* History */
export const historyTransition = z.enum([
  'link',
  'typed',
  'bookmark',
  'reload',
  'form_submit',
  'redirect',
  'generated',
]);
export const recordVisitInput = z.object({
  profileId: zId,
  url: zUrl,
  title: z.string().default(''),
  transition: historyTransition.default('link'),
  workspaceId: zId.nullish(),
});
export const historyQueryInput = z.object({
  profileId: zId,
  query: z.string().default(''),
  limit: z.number().int().positive().max(1000).default(200),
  offset: z.number().int().nonnegative().default(0),
  from: z.number().int().optional(),
  to: z.number().int().optional(),
});
export const deleteHistoryInput = z.object({
  profileId: zId,
  entryIds: z.array(zId).optional(),
  url: zUrl.optional(),
  from: z.number().int().optional(),
  to: z.number().int().optional(),
});

/* Downloads */
export const downloadRef = z.object({ downloadId: zId });
export const startDownloadInput = z.object({
  url: zUrl,
  profileId: zId,
  savePath: z.string().optional(),
});
export const listDownloadsInput = z.object({ profileId: zId });
