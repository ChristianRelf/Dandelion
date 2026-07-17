import { z } from 'zod';
import { must, publicProcedure, router } from '../trpc';
import {
  addBookmarkInput,
  bookmarkRef,
  createFolderInput,
  deleteHistoryInput,
  downloadRef,
  historyQueryInput,
  listBookmarksInput,
  startDownloadInput,
  updateBookmarkInput,
} from '@shared/schemas/browsing.schema';

const profileRef = z.object({ profileId: z.string() });

export const historyRoutes = router({
  search: publicProcedure
    .input(historyQueryInput)
    .query(({ ctx, input }) => ctx.app.history.search(input)),
  topSites: publicProcedure
    .input(
      z.object({ profileId: z.string(), limit: z.number().int().positive().max(50).default(12) }),
    )
    .query(({ ctx, input }) => ctx.app.history.topSites(input.profileId, input.limit)),
  delete: publicProcedure.input(deleteHistoryInput).mutation(({ ctx, input }) => {
    if (input.entryIds) ctx.app.history.deleteEntries(input.entryIds);
    else if (input.url) ctx.app.history.deleteByUrl(input.profileId, input.url);
    else if (input.from !== undefined && input.to !== undefined) {
      ctx.app.history.deleteRange(input.profileId, input.from, input.to);
    }
    return true;
  }),
  clear: publicProcedure.input(profileRef).mutation(({ ctx, input }) => {
    ctx.app.history.clear(input.profileId);
    return true;
  }),
});

export const bookmarkRoutes = router({
  list: publicProcedure
    .input(listBookmarksInput)
    .query(({ ctx, input }) =>
      ctx.app.bookmarks.list(input.profileId, input.folderId, input.query),
    ),
  isBookmarked: publicProcedure
    .input(z.object({ profileId: z.string(), url: z.string() }))
    .query(({ ctx, input }) => ctx.app.bookmarks.isBookmarked(input.profileId, input.url)),
  add: publicProcedure.input(addBookmarkInput).mutation(({ ctx, input }) =>
    ctx.app.bookmarks.add({
      profileId: input.profileId,
      url: input.url,
      title: input.title,
      folderId: input.folderId ?? null,
      workspaceId: input.workspaceId ?? null,
      tags: input.tags,
      description: input.description,
    }),
  ),
  update: publicProcedure.input(updateBookmarkInput).mutation(({ ctx, input }) =>
    must(
      ctx.app.bookmarks.update(input.bookmarkId, {
        title: input.title,
        url: input.url,
        folderId: input.folderId,
        tags: input.tags,
        description: input.description,
      }),
    ),
  ),
  remove: publicProcedure.input(bookmarkRef).mutation(({ ctx, input }) => {
    ctx.app.bookmarks.remove(input.bookmarkId);
    return true;
  }),
  toggle: publicProcedure
    .input(
      z.object({
        profileId: z.string(),
        url: z.string(),
        title: z.string().default(''),
        workspaceId: z.string().nullable().default(null),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.app.bookmarks.toggle(input.profileId, input.url, input.title, input.workspaceId),
    ),
  listFolders: publicProcedure
    .input(profileRef)
    .query(({ ctx, input }) => ctx.app.bookmarks.listFolders(input.profileId)),
  createFolder: publicProcedure
    .input(createFolderInput)
    .mutation(({ ctx, input }) =>
      ctx.app.bookmarks.createFolder(input.profileId, input.name, input.parentId ?? null),
    ),
  renameFolder: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      ctx.app.bookmarks.renameFolder(input.id, input.name);
      return true;
    }),
  removeFolder: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.bookmarks.removeFolder(input.id);
    return true;
  }),
  export: publicProcedure
    .input(profileRef)
    .query(({ ctx, input }) => ctx.app.bookmarks.exportHtml(input.profileId)),
  import: publicProcedure
    .input(z.object({ profileId: z.string(), contents: z.string() }))
    .mutation(({ ctx, input }) => ctx.app.bookmarks.importFile(input.profileId, input.contents)),
});

export const downloadRoutes = router({
  list: publicProcedure
    .input(profileRef)
    .query(({ ctx, input }) => ctx.app.downloads.list(input.profileId)),
  pause: publicProcedure.input(downloadRef).mutation(({ ctx, input }) => {
    ctx.app.downloads.pause(input.downloadId);
    return true;
  }),
  resume: publicProcedure.input(downloadRef).mutation(({ ctx, input }) => {
    ctx.app.downloads.resume(input.downloadId);
    return true;
  }),
  cancel: publicProcedure.input(downloadRef).mutation(({ ctx, input }) => {
    ctx.app.downloads.cancel(input.downloadId);
    return true;
  }),
  remove: publicProcedure.input(downloadRef).mutation(({ ctx, input }) => {
    ctx.app.downloads.remove(input.downloadId);
    return true;
  }),
  /** Rejects if the file cannot be opened, so the renderer's error toast can run. */
  openFile: publicProcedure.input(downloadRef).mutation(async ({ ctx, input }) => {
    await ctx.app.downloads.openFile(input.downloadId);
    return true;
  }),
  showInFolder: publicProcedure.input(downloadRef).mutation(({ ctx, input }) => {
    ctx.app.downloads.showInFolder(input.downloadId);
    return true;
  }),
  clearCompleted: publicProcedure.input(profileRef).mutation(({ ctx, input }) => {
    ctx.app.downloads.clearCompleted(input.profileId);
    return true;
  }),
  start: publicProcedure.input(startDownloadInput).mutation(({ ctx, input }) => {
    const profile = ctx.app.profiles.get(input.profileId);
    if (profile) ctx.app.downloads.startOnSession(ctx.app.sessions.getSession(profile), input.url);
    return true;
  }),
});
