import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export type AsyncStatus = 'loading' | 'ready' | 'error';

export interface AsyncData<T> {
  status: AsyncStatus;
  data: T;
  error: string | null;
  /** Re-run the fetcher, keeping the current data visible until it resolves. */
  reload: () => void;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong.';
}

/**
 * Fetch data with first-class loading and error states. Starts in `loading`
 * (so callers never flash an empty state before the first resolve), ignores
 * responses from superseded requests, and never sets state after unmount.
 *
 * Pass the values the fetcher closes over as `deps`, exactly like `useEffect`.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  initial: T,
): AsyncData<T> {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(() => {
    const seq = ++seqRef.current;
    setStatus('loading');
    setError(null);
    fetcherRef.current().then(
      (result) => {
        if (mountedRef.current && seq === seqRef.current) {
          setData(result);
          setStatus('ready');
        }
      },
      (err: unknown) => {
        if (mountedRef.current && seq === seqRef.current) {
          setError(messageOf(err));
          setStatus('error');
        }
      },
    );
  }, []);

  // `deps` is the caller-supplied dependency list for the fetcher; `load` is stable.
  useEffect(() => {
    load();
  }, deps);

  return { status, data, error, reload: load };
}
