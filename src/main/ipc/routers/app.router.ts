import { z } from 'zod';
import { publicProcedure, requireWindowId, router } from '../trpc';
import { popupOpenInput, popupResizeInput } from '@shared/schemas/popup.schema';
import { executeCommand } from '../../app/command-executor';

const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const appRoutes = router({
  info: publicProcedure.query(({ ctx }) => ({
    name: 'Dandelion',
    version: ctx.app.updates.currentVersion(),
    platform: process.platform,
  })),

  /** Everything the renderer needs to render its window on first paint. */
  initialState: publicProcedure.query(({ ctx }) => {
    const dandelionWindow = ctx.windowId
      ? ctx.app.windows.get(ctx.windowId)
      : ctx.app.windows.first();

    const activeWorkspace = dandelionWindow?.activeWorkspaceId
      ? ctx.app.workspaces.get(dandelionWindow.activeWorkspaceId)
      : null;
    const profile =
      (activeWorkspace ? ctx.app.profiles.get(activeWorkspace.profileId) : null) ??
      ctx.app.profiles.getDefault() ??
      ctx.app.profiles.ensureDefault();

    const workspaces = ctx.app.workspaces.list(profile.id);
    const activeWorkspaceId = dandelionWindow?.activeWorkspaceId ?? workspaces[0]?.id ?? null;

    return {
      windowId: ctx.windowId,
      profile,
      profiles: ctx.app.profiles.list(),
      workspaces,
      activeWorkspaceId,
      settings: ctx.app.settings.get(),
      window: dandelionWindow?.toState() ?? null,
      vault: ctx.app.vault.state(profile.id),
    };
  }),

  runCommand: publicProcedure
    .input(z.object({ commandId: z.string() }))
    .mutation(({ ctx, input }) => {
      executeCommand(ctx.app, input.commandId, ctx.windowId);
      return true;
    }),

  restoreWorkspace: publicProcedure
    .input(z.object({ workspaceId: z.string() }))
    .mutation(({ ctx, input }) => {
      const windowId = requireWindowId(ctx);
      ctx.app.tabs.restoreWorkspace(windowId, input.workspaceId);
      return {
        tabs: ctx.app.tabs.listInWindow(windowId, input.workspaceId),
        groups: ctx.app.tabs.listGroups(input.workspaceId),
      };
    }),

  recentlyClosed: publicProcedure.query(({ ctx }) => ctx.app.tabs.recentlyClosedTabs()),

  checkForUpdates: publicProcedure.mutation(({ ctx }) => ctx.app.updates.check()),
  /** The updater's whole state. Survives a renderer reload. */
  updateStatus: publicProcedure.query(({ ctx }) => ctx.app.updates.status()),
  installUpdate: publicProcedure.mutation(({ ctx }) => ctx.app.updates.install()),
  dismissUpdate: publicProcedure
    .input(z.object({ version: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.app.updates.dismiss(input.version);
      return true;
    }),
});

export const windowRoutes = router({
  minimize: publicProcedure.mutation(({ ctx }) => {
    ctx.app.windows.minimize(requireWindowId(ctx));
    return true;
  }),
  toggleMaximize: publicProcedure.mutation(({ ctx }) => {
    ctx.app.windows.toggleMaximize(requireWindowId(ctx));
    return true;
  }),
  close: publicProcedure.mutation(({ ctx }) => {
    ctx.app.windows.close(requireWindowId(ctx));
    return true;
  }),
  setFullScreen: publicProcedure
    .input(z.object({ value: z.boolean() }))
    .mutation(({ ctx, input }) => {
      ctx.app.windows.setFullScreen(requireWindowId(ctx), input.value);
      return true;
    }),
  newWindow: publicProcedure.mutation(({ ctx }) => {
    ctx.app.openWindow();
    return true;
  }),
});

export const layoutRoutes = router({
  setContentBounds: publicProcedure.input(boundsSchema).mutation(({ ctx, input }) => {
    ctx.app.tabs.setContentBounds(requireWindowId(ctx), input);
    return true;
  }),
  setContentVisible: publicProcedure
    .input(z.object({ visible: z.boolean() }))
    .mutation(({ ctx, input }) => {
      ctx.app.tabs.setContentVisible(requireWindowId(ctx), input.visible);
      return true;
    }),
});

/**
 * The surface that floats toolbar popovers above the page. `open` is called by
 * the chrome; `resize` by the popup itself once it knows how big it is — which
 * is why both resolve their window from the caller rather than taking one.
 */
export const popupRoutes = router({
  open: publicProcedure.input(popupOpenInput).mutation(({ ctx, input }) => {
    ctx.app.popups.open(requireWindowId(ctx), input.kind, input.anchor);
    return true;
  }),
  close: publicProcedure.mutation(({ ctx }) => {
    ctx.app.popups.close(requireWindowId(ctx));
    return true;
  }),
  resize: publicProcedure.input(popupResizeInput).mutation(({ ctx, input }) => {
    ctx.app.popups.resize(requireWindowId(ctx), input);
    return true;
  }),
});
