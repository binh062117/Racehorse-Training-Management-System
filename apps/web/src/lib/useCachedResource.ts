import { useCallback, useEffect, useRef, useState } from 'react';
import { getCached, setCached } from './dataCache';

/**
 * Stale-while-revalidate: if `key` was fetched before (even on a page the
 * user has since navigated away from and back to), render that cached
 * value immediately — no loading spinner — while silently re-fetching in
 * the background to pick up anything new. First-ever fetch for a key still
 * shows the normal loading state.
 */
export function useCachedResource<T>(key: string, fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(() => getCached<T>(key) ?? null);
  const [loading, setLoading] = useState(() => getCached<T>(key) === undefined);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setCached(key, result);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // New key (e.g. filters changed) with no cache entry yet — show the
    // loading state again instead of the previous key's stale data.
    if (getCached<T>(key) === undefined) {
      setData(null);
      setLoading(true);
    }
    void load();
  }, [key, load]);

  return { data, loading, error, reload: load };
}
