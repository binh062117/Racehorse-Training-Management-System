/**
 * Tiny in-memory cache for GET responses, keyed by a string the caller
 * builds (usually endpoint + serialized params). Lives at module scope so
 * it survives component unmount/remount across route navigation — not
 * persisted to localStorage, cleared on full page reload.
 */
const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}
