import { publicProcedure, must, router } from '../trpc';
import {
  createProfileInput,
  createWorkspaceInput,
  profileRef,
  reorderWorkspacesInput,
  updateProfileInput,
  updateWorkspaceInput,
  workspaceRef,
} from '@shared/schemas/workspaces.schema';

export const profileRoutes = router({
  list: publicProcedure.query(({ ctx }) => ctx.app.profiles.list()),
  get: publicProcedure
    .input(profileRef)
    .query(({ ctx, input }) => ctx.app.profiles.get(input.profileId)),
  create: publicProcedure
    .input(createProfileInput)
    .mutation(({ ctx, input }) => ctx.app.profiles.create(input)),
  update: publicProcedure.input(updateProfileInput).mutation(({ ctx, input }) =>
    must(
      ctx.app.profiles.update(input.profileId, {
        name: input.name,
        color: input.color,
        avatar: input.avatar,
      }),
    ),
  ),
  delete: publicProcedure
    .input(profileRef)
    .mutation(({ ctx, input }) => must(ctx.app.profiles.delete(input.profileId))),
});

export const workspaceRoutes = router({
  list: publicProcedure
    .input(profileRef)
    .query(({ ctx, input }) => ctx.app.workspaces.list(input.profileId)),
  listAll: publicProcedure.query(({ ctx }) => ctx.app.workspaces.listAll()),
  get: publicProcedure
    .input(workspaceRef)
    .query(({ ctx, input }) => ctx.app.workspaces.get(input.workspaceId)),
  create: publicProcedure
    .input(createWorkspaceInput)
    .mutation(({ ctx, input }) => ctx.app.workspaces.create(input)),
  update: publicProcedure.input(updateWorkspaceInput).mutation(({ ctx, input }) =>
    must(
      ctx.app.workspaces.update(input.workspaceId, {
        name: input.name,
        icon: input.icon,
        accentColor: input.accentColor,
        wallpaper: input.wallpaper,
      }),
    ),
  ),
  delete: publicProcedure
    .input(workspaceRef)
    .mutation(({ ctx, input }) => must(ctx.app.workspaces.delete(input.workspaceId))),
  reorder: publicProcedure.input(reorderWorkspacesInput).mutation(({ ctx, input }) => {
    ctx.app.workspaces.reorder(input.orderedIds);
    return true;
  }),
});
