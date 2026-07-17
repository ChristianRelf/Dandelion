import { z } from 'zod';
import { publicProcedure, requireWindowId, router } from '../trpc';

export const sessionRoutes = router({
  list: publicProcedure.query(({ ctx }) => ctx.app.listSessions()),
  /** `false` when there was nothing open to save — the caller reports it rather than claiming success. */
  saveCurrent: publicProcedure.mutation(({ ctx }) => ctx.app.saveSession('manual') !== null),
  restore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.app.restoreSession(input.id, requireWindowId(ctx))),
  remove: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.removeSession(input.id);
    return true;
  }),
});
