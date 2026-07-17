import { z } from 'zod';
import { must, publicProcedure, router } from '../trpc';

const profileRef = z.object({ profileId: z.string() });

export const notesRoutes = router({
  list: publicProcedure
    .input(profileRef)
    .query(({ ctx, input }) => ctx.app.notes.list(input.profileId)),
  create: publicProcedure
    .input(profileRef)
    .mutation(({ ctx, input }) => ctx.app.notes.create(input.profileId)),
  update: publicProcedure
    .input(z.object({ id: z.string(), content: z.string() }))
    .mutation(({ ctx, input }) => must(ctx.app.notes.update(input.id, input.content))),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.notes.remove(input.id);
    return true;
  }),
});
