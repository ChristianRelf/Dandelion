import { TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import superjson from 'superjson';
import type { AppRouter } from '@main/ipc/router';

/**
 * A custom tRPC link that carries operations over the Electron contextBridge
 * (`window.dandelion.trpc.invoke`) instead of HTTP. Inputs/outputs are
 * transported with superjson so rich types survive the boundary. Subscriptions
 * are intentionally unsupported — reactive updates flow through the dedicated
 * event channel instead.
 */
export function ipcLink(): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        if (op.type === 'subscription') {
          observer.error(new TRPCClientError('Subscriptions are not supported over IPC'));
          return;
        }

        const input = op.input === undefined ? undefined : superjson.serialize(op.input);
        window.dandelion.trpc
          .invoke({ type: op.type, path: op.path, input })
          .then((result) => {
            if (result.ok) {
              observer.next({
                result: { type: 'data', data: superjson.deserialize(result.data as never) },
              });
              observer.complete();
            } else {
              const error = new TRPCClientError(result.error.message);
              observer.error(error);
            }
          })
          .catch((error: unknown) => observer.error(TRPCClientError.from(error as Error)));

        return () => {
          /* nothing to tear down for a one-shot invoke */
        };
      });
}
