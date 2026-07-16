import { createTRPCClient } from '@trpc/client';
import type { AppRouter } from '@main/ipc/router';
import { ipcLink } from './link';

/**
 * The fully-typed tRPC client. Call procedures directly:
 *   await trpc.tabs.create.mutate({ workspaceId });
 *   const state = await trpc.app.initialState.query();
 */
export const trpc = createTRPCClient<AppRouter>({ links: [ipcLink()] });

export type TrpcClient = typeof trpc;
