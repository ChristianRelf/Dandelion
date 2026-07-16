import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const extensionRoutes = router({
  list: publicProcedure.query(({ ctx }) => ctx.app.extensions.list()),
  loadUnpacked: publicProcedure.mutation(({ ctx }) => ctx.app.extensions.loadUnpacked()),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.extensions.remove(input.id);
    return true;
  }),
});
