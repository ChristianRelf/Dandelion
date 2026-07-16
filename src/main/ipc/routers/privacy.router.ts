import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import {
  clearDataInput,
  deleteCookieInput,
  listCookiesInput,
  listPermissionsInput,
  originRef,
  respondPermissionInput,
  setPermissionInput,
} from '@shared/schemas/privacy.schema';

export const permissionRoutes = router({
  list: publicProcedure
    .input(listPermissionsInput)
    .query(({ ctx, input }) => ctx.app.permissions.list(input.profileId, input.origin)),
  set: publicProcedure
    .input(setPermissionInput)
    .mutation(({ ctx, input }) =>
      ctx.app.permissions.set(input.profileId, input.origin, input.type, input.decision),
    ),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.permissions.remove(input.id);
    return true;
  }),
  clearOrigin: publicProcedure.input(originRef).mutation(({ ctx, input }) => {
    ctx.app.permissions.clearOrigin(input.profileId, input.origin);
    return true;
  }),
  respond: publicProcedure.input(respondPermissionInput).mutation(({ ctx, input }) => {
    ctx.app.permissions.respond(input.requestId, input.decision, input.remember);
    return true;
  }),
});

export const cookieRoutes = router({
  list: publicProcedure.input(listCookiesInput).query(async ({ ctx, input }) => {
    const profile = ctx.app.profiles.get(input.profileId);
    if (!profile) return [];
    return ctx.app.sessions.getCookies(profile, input.domain);
  }),
  remove: publicProcedure.input(deleteCookieInput).mutation(async ({ ctx, input }) => {
    const profile = ctx.app.profiles.get(input.profileId);
    if (profile) {
      await ctx.app.sessions.removeCookie(
        profile,
        input.name,
        input.domain,
        input.path,
        input.secure,
      );
    }
    return true;
  }),
});

export const privacyRoutes = router({
  clearData: publicProcedure.input(clearDataInput).mutation(async ({ ctx, input }) => {
    const profile = ctx.app.profiles.get(input.profileId);
    if (!profile) return true;
    const { options } = input;

    await ctx.app.sessions.clearData(profile, {
      cookies: options.cookies,
      cache: options.cache,
      storage: options.formData,
    });
    if (options.history) ctx.app.history.clear(profile.id);
    if (options.downloads) ctx.app.downloads.clearCompleted(profile.id);
    if (options.passwords) {
      for (const entry of ctx.app.vault.list(profile.id)) ctx.app.vault.remove(entry.id);
    }
    return true;
  }),
});
