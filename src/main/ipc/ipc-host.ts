import { BrowserWindow, ipcMain } from 'electron';
import superjson from 'superjson';
import { TRPCError } from '@trpc/server';
import { IPC } from '@shared/ipc/channels';
import type { IpcTrpcOp, IpcTrpcResult, SerializedTrpcError } from '@shared/ipc/contract';
import type { AppContext } from '../app/app-context';
import { createCallerFactory, type RouterContext } from './trpc';
import { appRouter } from './router';

type SuperJsonPayload = Parameters<typeof superjson.deserialize>[0];

function serializeError(error: unknown): SerializedTrpcError {
  if (error instanceof TRPCError) {
    return {
      message: error.message,
      code: error.code,
      data: superjson.serialize(error.cause ?? null),
    };
  }
  if (error instanceof Error) {
    return { message: error.message, code: 'INTERNAL_SERVER_ERROR' };
  }
  return { message: 'Unknown error', code: 'INTERNAL_SERVER_ERROR' };
}

/**
 * The transport that backs the typed tRPC-over-IPC bridge. Each `invoke` is
 * resolved by traversing a per-call tRPC caller by dotted path; inputs and
 * results cross the boundary via superjson. Domain events are forwarded from the
 * EventBus to every chrome renderer.
 */
/**
 * Walk `op.path` to the procedure it names, using own properties only.
 *
 * A plain property walk guarded with `typeof target === 'function'` accepts
 * inherited members too: `"constructor"` resolves to `Object`, and
 * `"__proto__.constructor.constructor"` to `Function`. Neither was exploitable —
 * the result is only ever called with one superjson value, never eval'd, and
 * only the trusted chrome can reach this channel — but a lookup that can land
 * anywhere on the prototype chain is not a lookup, it is a coincidence.
 */
function resolveProcedure(caller: unknown, path: string): ((input: unknown) => unknown) | null {
  let target: unknown = caller;
  for (const part of path.split('.')) {
    if (typeof target !== 'object' || target === null) return null;
    if (!Object.hasOwn(target, part)) return null;
    target = (target as Record<string, unknown>)[part];
  }
  return typeof target === 'function' ? (target as (input: unknown) => unknown) : null;
}

export function registerIpcHost(context: AppContext): void {
  const createCaller = createCallerFactory(appRouter);

  ipcMain.handle(IPC.trpc, async (event, op: IpcTrpcOp): Promise<IpcTrpcResult> => {
    // A popup surface is a view, not a window, so `fromWebContents` cannot place
    // it — and every window-scoped proc it calls would be rejected. It belongs to
    // the window hosting it.
    const windowId =
      context.windows.fromWebContents(event.sender)?.id ?? context.popups.ownerOf(event.sender);
    const routerContext: RouterContext = { app: context, windowId };
    const caller = createCaller(routerContext);
    const input =
      op.input === undefined ? undefined : superjson.deserialize(op.input as SuperJsonPayload);

    try {
      const target = resolveProcedure(caller, op.path);
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown procedure: ${op.path}` });
      }
      const data = await target(input);
      return { ok: true, data: superjson.serialize(data) };
    } catch (error) {
      return { ok: false, error: serializeError(error) };
    }
  });

  context.events.subscribe((browserEvent) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC.event, browserEvent);
    }
    // Popup surfaces are child views, so `getAllWindows` does not reach them and
    // they would never hear that their state moved.
    for (const webContents of context.popups.surfaceContents()) {
      if (!webContents.isDestroyed()) webContents.send(IPC.event, browserEvent);
    }
  });
}
