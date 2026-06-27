import { useEffect, useState } from 'react';

/**
 * Like useState, but the value is persisted to localStorage under `key` and
 * restored on the next visit. Use a list-scoped key (e.g. "resources.sortKey")
 * so each listing keeps its own sort/paging preferences.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable (e.g. private mode) — ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
