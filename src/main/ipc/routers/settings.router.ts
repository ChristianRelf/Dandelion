import { z } from 'zod';
import type { SettingsPatch, SyncEntityType } from '@shared/types';
import { publicProcedure, router } from '../trpc';
import {
  settingsPatchSchema,
  updateGestureInput,
  updateShortcutInput,
} from '@shared/schemas/settings.schema';

const syncEntity = z.enum([
  'bookmarks',
  'history',
  'tabs',
  'passwords',
  'settings',
  'profiles',
  'sessions',
]);

export const settingsRoutes = router({
  get: publicProcedure.query(({ ctx }) => ctx.app.settings.get()),
  update: publicProcedure
    .input(settingsPatchSchema)
    .mutation(({ ctx, input }) => ctx.app.settings.update(input as SettingsPatch)),
  reset: publicProcedure.mutation(({ ctx }) => ctx.app.settings.reset()),
  setShortcut: publicProcedure.input(updateShortcutInput).mutation(({ ctx, input }) => {
    const shortcuts = ctx.app.settings
      .get()
      .shortcuts.filter((binding) => binding.action !== input.action);
    shortcuts.push({ action: input.action, keys: input.keys, enabled: input.enabled });
    return ctx.app.settings.update({ shortcuts });
  }),
  setGesture: publicProcedure.input(updateGestureInput).mutation(({ ctx, input }) => {
    const current = ctx.app.settings.get().gestures;
    // A stroke means one thing, so assigning it to a command takes it from
    // whichever command had it — the same rule the keyboard editor applies by
    // letting the last binding win, made explicit because a silently shadowed
    // gesture is invisible where a shadowed accelerator at least appears twice.
    const bindings = current.bindings.filter(
      (binding) =>
        binding.action !== input.action && !(input.gesture && binding.gesture === input.gesture),
    );
    if (input.gesture) {
      bindings.push({ action: input.action, gesture: input.gesture, enabled: input.enabled });
    }
    return ctx.app.settings.update({ gestures: { ...current, bindings } });
  }),
});

export const syncRoutes = router({
  getState: publicProcedure.query(({ ctx }) => ctx.app.sync.getState()),
  providers: publicProcedure.query(({ ctx }) => ctx.app.sync.availableProviders()),
  setEnabled: publicProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(({ ctx, input }) => ctx.app.sync.setEnabled(input.enabled)),
  setEntity: publicProcedure
    .input(z.object({ entity: syncEntity, enabled: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.app.sync.setEntity(input.entity as SyncEntityType, input.enabled),
    ),
  sync: publicProcedure.mutation(({ ctx }) => ctx.app.sync.sync()),
});
