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
export function registerIpcHost(context: AppContext): void {
  const createCaller = createCallerFactory(appRouter);

  ipcMain.handle(IPC.trpc, async (event, op: IpcTrpcOp): Promise<IpcTrpcResult> => {
    const dandelionWindow = context.windows.fromWebContents(event.sender);
    const routerContext: RouterContext = { app: context, windowId: dandelionWindow?.id ?? null };
    const caller = createCaller(routerContext);
    const input =
      op.input === undefined ? undefined : superjson.deserialize(op.input as SuperJsonPayload);

    try {
      let target: unknown = caller;
      for (const part of op.path.split('.')) {
        target = (target as Record<string, unknown> | undefined)?.[part];
      }
      if (typeof target !== 'function') {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Unknown procedure: ${op.path}` });
      }
      const data = await (target as (input: unknown) => unknown)(input);
      return { ok: true, data: superjson.serialize(data) };
    } catch (error) {
      return { ok: false, error: serializeError(error) };
    }
  });

  context.events.subscribe((browserEvent) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC.event, browserEvent);
    }
  });
}
