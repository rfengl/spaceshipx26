import { useEffect, useState, type DependencyList } from 'react';

/** A `<select>` choice: the submitted `value` and its human-readable `label`. */
export interface Option {
  value: string;
  label: string;
}

/**
 * Loads the choices for a `<select>` filter: runs `loader` on mount (and when
 * `deps` change), maps the result to `{ value, label }` via `toOptions`, and
 * returns the list. It's the best-effort, dropdown-shaped cousin of
 * {@link useAsyncLoad} — it owns the option list and nothing else, so callers
 * just render the returned array.
 *
 * Failure is deliberately swallowed: these options only populate a filter, so if
 * the fetch fails we leave the list empty rather than block the page or surface
 * an error. The page's primary data (and the select's own "All" entry) keep
 * working, and the empty `.catch` is intentional — not a forgotten handler. A
 * floating rejection here would otherwise become an unhandled promise rejection.
 */
export function useAsyncOptions<T>(
  loader: () => Promise<T>,
  toOptions: (data: T) => Option[],
  deps: DependencyList = [],
): Option[] {
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    let active = true;
    loader()
      .then((data) => active && setOptions(toOptions(data)))
      // Best-effort: a failed dropdown source just stays empty (see above).
      .catch(() => active && setOptions([]));
    return () => {
      active = false;
    };
    // The loader/toOptions close over `deps`; re-running on their identity would
    // refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps]);

  return options;
}
