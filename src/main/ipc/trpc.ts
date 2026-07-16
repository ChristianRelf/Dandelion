import { initTRPC, TRPCError } from '@trpc/server';
import type { Result } from '@shared/types';
import type { AppContext } from '../app/app-context';

/** Per-call tRPC context: the app container plus the calling window's id. */
export interface RouterContext {
  app: AppContext;
  windowId: string | null;
}

const t = initTRPC.context<RouterContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/** Unwrap a service `Result`, converting an `Err` into a tRPC error. */
export function must<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: result.error.message,
    cause: result.error.code,
  });
}

/** Resolve the calling window id or throw if the call arrived without one. */
export function requireWindowId(ctx: RouterContext): string {
  if (!ctx.windowId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No window context' });
  }
  return ctx.windowId;
}
