/**
 * A lightweight, serialisable `Result` type used across process boundaries.
 *
 * Errors that cross the IPC boundary must be plain data (they cannot carry a
 * live `Error` prototype), so services return `Result<T>` rather than throwing
 * where a failure is an expected, recoverable outcome.
 */

export interface AppError {
  /** Stable, machine-readable identifier, e.g. `vault/locked`. */
  readonly code: string;
  /** Human-readable, user-safe message. */
  readonly message: string;
  /** Optional non-user-facing diagnostic detail. */
  readonly detail?: string;
}

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = AppError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const appError = (code: string, message: string, detail?: string): AppError => ({
  code,
  message,
  ...(detail !== undefined ? { detail } : {}),
});

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

/** Unwrap a result or throw — use only where a failure is genuinely unexpected. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  const error = result.error as { message?: unknown };
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(result.error);
  throw new Error(message);
}
