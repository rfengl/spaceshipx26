import { useEffect, useState, type DependencyList } from 'react';

import { errorMessage } from '../utils/errorMessage';

/**
 * The loading/error lifecycle shared by data-fetch pages — the read counterpart
 * to {@link useAsyncAction}. It runs `loader` on mount and whenever `deps`
 * change, hands the resolved value to `onLoad`, and captures any thrown value as
 * a user-facing `error`. An out-of-order guard drops a slow earlier response so
 * it can't overwrite a newer one — so callers stop hand-rolling the
 * setLoading / try / catch / `active`-flag boilerplate.
 *
 * The caller keeps owning its own data state, so in-place patches (optimistic
 * edits, socket pushes) and multi-value results (e.g. a page + its total) stay
 * where they belong; this hook only owns `loading` and `error`. `loading` starts
 * true and flips around each run. `error` reports a failed load — mutations on
 * the same page own their own error via {@link useAsyncAction}. `reload` re-runs
 * the loader on demand (e.g. after a mutation).
 *
 * Like the pages it replaces, the loader is re-run only on the explicit `deps`
 * (and `reload`), not on its own or `onLoad`'s identity — so list any value the
 * loader closes over that should trigger a refetch.
 */
export function useAsyncLoad<T>(
  loader: () => Promise<T>,
  onLoad: (data: T) => void,
  deps: DependencyList = [],
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const reload = () => setReloadCount((n) => n + 1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loader()
      .then((value) => active && onLoad(value))
      .catch((e) => active && setError(errorMessage(e)))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // The loader/onLoad close over `deps`; re-running on their identity would
    // refetch every render. `reloadCount` drives the explicit `reload()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  return { loading, error, reload };
}
