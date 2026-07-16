import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

export const sessionRoutes = router({
  list: publicProcedure.query(({ ctx }) => ctx.app.listSessions()),
  saveCurrent: publicProcedure.mutation(({ ctx }) => {
    ctx.app.saveSession('manual');
    return true;
  }),
  restore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.app.restoreSession(input.id)),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.removeSession(input.id);
    return true;
  }),
});
