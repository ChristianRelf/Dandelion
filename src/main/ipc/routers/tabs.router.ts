import { z } from 'zod';
import { publicProcedure, requireWindowId, router } from '../trpc';
import {
  createGroupInput,
  createTabInput,
  findInPageInput,
  goToOffsetInput,
  groupRef,
  moveTabInput,
  navigateInput,
  reorderTabsInput,
  setMutedInput,
  setPinnedInput,
  splitRatioInput,
  splitViewInput,
  stopFindInput,
  tabRef,
  updateGroupInput,
} from '@shared/schemas/tabs.schema';

const workspaceRef = z.object({ workspaceId: z.string() });

export const tabRoutes = router({
  create: publicProcedure.input(createTabInput).mutation(({ ctx, input }) =>
    ctx.app.tabs.createTab({
      workspaceId: input.workspaceId,
      url: input.url,
      groupId: input.groupId,
      index: input.index,
      active: input.active,
      openerTabId: input.openerTabId,
      windowId: input.windowId ?? ctx.windowId ?? undefined,
    }),
  ),
  get: publicProcedure.input(tabRef).query(({ ctx, input }) => ctx.app.tabs.get(input.tabId)),
  /** The calling window's tabs — the same scope `app.restoreWorkspace` returns. */
  listByWorkspace: publicProcedure
    .input(workspaceRef)
    .query(({ ctx, input }) => ctx.app.tabs.listInWindow(requireWindowId(ctx), input.workspaceId)),
  listGroups: publicProcedure
    .input(workspaceRef)
    .query(({ ctx, input }) => ctx.app.tabs.listGroups(input.workspaceId)),

  activate: publicProcedure.input(tabRef).mutation(({ ctx, input }) => {
    ctx.app.tabs.activate(input.tabId);
    return true;
  }),
  close: publicProcedure.input(tabRef).mutation(({ ctx, input }) => {
    ctx.app.tabs.close(input.tabId);
    return true;
  }),
  /** One call for one intent: the renderer used to loop and close them itself. */
  closeOthers: publicProcedure.input(tabRef).mutation(({ ctx, input }) => {
    ctx.app.tabs.closeOthers(input.tabId);
    return true;
  }),
  closeToRight: publicProcedure.input(tabRef).mutation(({ ctx, input }) => {
    ctx.app.tabs.closeToRight(input.tabId);
    return true;
  }),
  navigate: publicProcedure.input(navigateInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.navigate(input.tabId, input.url);
    return true;
  }),
  goToOffset: publicProcedure.input(goToOffsetInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.goToOffset(input.tabId, input.offset);
    return true;
  }),
  reload: publicProcedure
    .input(z.object({ tabId: z.string(), ignoreCache: z.boolean().default(false) }))
    .mutation(({ ctx, input }) => {
      ctx.app.tabs.reload(input.tabId, input.ignoreCache);
      return true;
    }),
  stop: publicProcedure.input(tabRef).mutation(({ ctx, input }) => {
    ctx.app.tabs.stop(input.tabId);
    return true;
  }),
  /** Resolves false when the tab has no view to print — see `TabManager.print`. */
  print: publicProcedure
    .input(tabRef)
    .mutation(({ ctx, input }) => ctx.app.tabs.print(input.tabId)),
  setMuted: publicProcedure.input(setMutedInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.setMuted(input.tabId, input.muted);
    return true;
  }),
  setPinned: publicProcedure.input(setPinnedInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.setPinned(input.tabId, input.pinned);
    return true;
  }),
  sleep: publicProcedure.input(tabRef).mutation(({ ctx, input }) => {
    ctx.app.tabs.sleep(input.tabId);
    return true;
  }),
  duplicate: publicProcedure
    .input(tabRef)
    .mutation(({ ctx, input }) => ctx.app.tabs.duplicate(input.tabId)),
  reorder: publicProcedure.input(reorderTabsInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.reorder(input.workspaceId, input.orderedTabIds);
    return true;
  }),
  move: publicProcedure.input(moveTabInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.move(input.tabId, input.toIndex, input.groupId ?? undefined, input.workspaceId);
    return true;
  }),

  createGroup: publicProcedure
    .input(createGroupInput)
    .mutation(({ ctx, input }) =>
      ctx.app.tabs.createGroup(input.workspaceId, input.name, input.color, input.tabIds),
    ),
  updateGroup: publicProcedure.input(updateGroupInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.updateGroup(input.groupId, {
      name: input.name,
      color: input.color,
      collapsed: input.collapsed,
    });
    return true;
  }),
  removeGroup: publicProcedure.input(groupRef).mutation(({ ctx, input }) => {
    ctx.app.tabs.removeGroup(input.groupId);
    return true;
  }),

  setSplit: publicProcedure.input(splitViewInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.setSplit(input.windowId, input.tabIds, input.orientation);
    return true;
  }),
  setSplitRatio: publicProcedure.input(splitRatioInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.setSplitRatio(input.windowId, input.ratio);
    return true;
  }),
  clearSplit: publicProcedure.mutation(({ ctx }) => {
    ctx.app.tabs.clearSplit(requireWindowId(ctx));
    return true;
  }),

  findInPage: publicProcedure.input(findInPageInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.findInPage(input.tabId, input.query, input.forward, input.matchCase);
    return true;
  }),
  stopFind: publicProcedure.input(stopFindInput).mutation(({ ctx, input }) => {
    ctx.app.tabs.stopFind(input.tabId, input.action);
    return true;
  }),
  capture: publicProcedure
    .input(tabRef)
    .mutation(({ ctx, input }) => ctx.app.tabs.captureThumbnail(input.tabId)),
  /** Save a full-resolution PNG of the page to Downloads. Rejects (for the toast) on an uncapturable tab. */
  screenshot: publicProcedure.input(tabRef).mutation(async ({ ctx, input }) => {
    const capture = await ctx.app.tabs.capturePng(input.tabId);
    if (!capture) throw new Error('This page can’t be captured');
    const profile = ctx.app.profiles.get(capture.profileId);
    if (!profile) throw new Error('Profile not found');
    return ctx.app.downloads.saveScreenshot(profile, capture.png, capture.url);
  }),
  getZoom: publicProcedure
    .input(tabRef)
    .query(({ ctx, input }) => ctx.app.tabs.getZoomPercent(input.tabId)),
  getReaderContent: publicProcedure
    .input(tabRef)
    .query(({ ctx, input }) => ctx.app.tabs.getReaderContent(input.tabId)),
});
