import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import {
  addSearchEngineInput,
  omniboxQueryInput,
  searchEngineRef,
  setDefaultEngineInput,
} from '@shared/schemas/omnibox.schema';
import {
  aiCompleteInput,
  aiConfigureInput,
  aiPageActionInput,
  promptTemplateInput,
} from '@shared/schemas/ai.schema';

export const searchRoutes = router({
  listEngines: publicProcedure.query(({ ctx }) => ctx.app.search.listEngines()),
  getDefault: publicProcedure.query(({ ctx }) => ctx.app.search.getDefault()),
  setDefault: publicProcedure.input(setDefaultEngineInput).mutation(({ ctx, input }) => {
    ctx.app.search.setDefault(input.engineId);
    return true;
  }),
  addEngine: publicProcedure
    .input(addSearchEngineInput)
    .mutation(({ ctx, input }) => ctx.app.search.addEngine(input)),
  removeEngine: publicProcedure.input(searchEngineRef).mutation(({ ctx, input }) => {
    ctx.app.search.removeEngine(input.engineId);
    return true;
  }),
});

export const omniboxRoutes = router({
  query: publicProcedure.input(omniboxQueryInput).query(({ ctx, input }) => {
    const profileId = input.profileId ?? ctx.app.profiles.getDefault()?.id ?? '';
    return ctx.app.omnibox.query(input.input, profileId, input.limit);
  }),
  resolve: publicProcedure
    .input(z.object({ input: z.string() }))
    .query(({ ctx, input }) => ctx.app.search.resolve(input.input)),
});

export const aiRoutes = router({
  providers: publicProcedure.query(({ ctx }) => ctx.app.ai.listProviders()),
  configure: publicProcedure.input(aiConfigureInput).mutation(({ ctx, input }) => {
    ctx.app.ai.configure(input.providerId, input.apiKey, input.baseUrl);
    return true;
  }),
  complete: publicProcedure.input(aiCompleteInput).mutation(({ ctx, input }) => ({
    requestId: ctx.app.ai.complete({ ...input, stream: true }),
  })),
  cancel: publicProcedure.input(z.object({ requestId: z.string() })).mutation(({ ctx, input }) => {
    ctx.app.ai.cancel(input.requestId);
    return true;
  }),
  pageAction: publicProcedure.input(aiPageActionInput).mutation(async ({ ctx, input }) => ({
    requestId: await ctx.app.ai.pageAction(input.tabId, input.task, input.targetLanguage),
  })),
  prompts: router({
    list: publicProcedure.query(({ ctx }) => ctx.app.ai.listPrompts()),
    save: publicProcedure
      .input(promptTemplateInput)
      .mutation(({ ctx, input }) => ctx.app.ai.savePrompt(input)),
    delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
      ctx.app.ai.deletePrompt(input.id);
      return true;
    }),
  }),
});
