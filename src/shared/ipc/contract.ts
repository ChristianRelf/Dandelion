/**
 * Wire contract for the tRPC-over-IPC transport. Payloads are serialised with
 * superjson so `Date`, `Map`, `Set` and `undefined` survive the structured
 * clone boundary. Request/response correlation is handled by `invoke`'s promise,
 * so no message id is needed.
 */

export interface IpcTrpcOp {
  type: 'query' | 'mutation';
  /** Dotted procedure path, e.g. `tabs.create`. */
  path: string;
  /** superjson-serialised input. */
  input: unknown;
}

export interface SerializedTrpcError {
  message: string;
  code: string;
  /** superjson-serialised `cause`/`data`, if any. */
  data?: unknown;
}

export type IpcTrpcResult = { ok: true; data: unknown } | { ok: false; error: SerializedTrpcError };
