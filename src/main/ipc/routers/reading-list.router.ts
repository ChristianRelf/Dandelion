import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const profileRef = z.object({ profileId: z.string() });

export const readingListRoutes = router({
  list: publicProcedure
    .input(profileRef)
    .query(({ ctx, input }) => ctx.app.readingList.list(input.profileId)),
  add: publicProcedure
    .input(
      z.object({
        profileId: z.string(),
        url: z.string(),
        title: z.string().default(''),
        favicon: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.app.readingList.add({
        profileId: input.profileId,
        url: input.url,
        title: input.title,
        favicon: input.favicon ?? null,
      }),
    ),
  setRead: publicProcedure
    .input(z.object({ id: z.string(), read: z.boolean() }))
    .mutation(({ ctx, input }) => {
      ctx.app.readingList.setRead(input.id, input.read);
      return true;
    }),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.readingList.remove(input.id);
    return true;
  }),
  clearRead: publicProcedure.input(profileRef).mutation(({ ctx, input }) => {
    ctx.app.readingList.clearRead(input.profileId);
    return true;
  }),
});
