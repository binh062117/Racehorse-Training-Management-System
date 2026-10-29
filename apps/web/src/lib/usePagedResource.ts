import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Paginated } from './types';

/** One server page per request; abort stale requests when filters/pages change. */
export function usePagedResource<T>(url: string, page: number, params: Record<string, string | number> = {}) {
  const query = JSON.stringify({ ...params, page, limit: 20 });
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; result?: Paginated<T>; error?: unknown }>({ key: '' });
  const key = `${url}:${query}:${attempt}`;
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    api.get<Paginated<T>>(url, { params: JSON.parse(query) as Record<string, string | number>, signal: controller.signal })
      .then((r) => { if (!controller.signal.aborted) setState({ key, result: r.data }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, error }); });
    return () => controller.abort();
  }, [url, query, key]);
  const current = state.key === key;
  return { data: current ? state.result?.data ?? [] : [], total: current ? state.result?.meta.total ?? 0 : 0, loading: !current, error: current ? state.error : null, refresh };
}
