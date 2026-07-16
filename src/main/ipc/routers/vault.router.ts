import { z } from 'zod';
import { must, publicProcedure, router } from '../trpc';
import {
  generatePasswordInput,
  initVaultInput,
  listPasswordsInput,
  passwordRef,
  revealPasswordInput,
  savePasswordInput,
  unlockVaultInput,
  updatePasswordInput,
  vaultRef,
} from '@shared/schemas/vault.schema';

export const vaultRoutes = router({
  state: publicProcedure
    .input(vaultRef)
    .query(({ ctx, input }) => ctx.app.vault.state(input.profileId)),
  init: publicProcedure
    .input(initVaultInput)
    .mutation(({ ctx, input }) => must(ctx.app.vault.init(input.profileId, input.masterPassword))),
  unlock: publicProcedure
    .input(unlockVaultInput)
    .mutation(({ ctx, input }) =>
      must(ctx.app.vault.unlock(input.profileId, input.masterPassword)),
    ),
  lock: publicProcedure.input(vaultRef).mutation(({ ctx, input }) => {
    ctx.app.vault.lock(input.profileId);
    return true;
  }),
  list: publicProcedure
    .input(listPasswordsInput)
    .query(({ ctx, input }) => ctx.app.vault.list(input.profileId, input.origin)),
  save: publicProcedure.input(savePasswordInput).mutation(({ ctx, input }) =>
    must(
      ctx.app.vault.save({
        profileId: input.profileId,
        origin: input.origin,
        username: input.username,
        password: input.password,
        note: input.note,
      }),
    ),
  ),
  update: publicProcedure.input(updatePasswordInput).mutation(({ ctx, input }) =>
    must(
      ctx.app.vault.update(input.entryId, {
        username: input.username,
        password: input.password,
        note: input.note,
      }),
    ),
  ),
  remove: publicProcedure.input(passwordRef).mutation(({ ctx, input }) => {
    ctx.app.vault.remove(input.entryId);
    return true;
  }),
  reveal: publicProcedure.input(revealPasswordInput).mutation(({ ctx, input }) => ({
    password: must(ctx.app.vault.reveal(input.entryId)),
  })),
  generate: publicProcedure.input(generatePasswordInput).query(({ ctx, input }) => ({
    password: ctx.app.vault.generate(input),
  })),
  setAutoLock: publicProcedure
    .input(z.object({ minutes: z.number().int().min(0).max(1440) }))
    .mutation(({ ctx, input }) => {
      ctx.app.vault.setAutoLockMinutes(input.minutes);
      return true;
    }),
});
