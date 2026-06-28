import { useState } from 'react';

import { errorMessage } from '../utils/errorMessage';

/**
 * The busy/error state machine shared by async submit handlers. `run` executes
 * an async action, flips a `busy` flag around it, and captures any thrown value
 * as a user-facing `error` message — so each caller stops repeating the
 * try / setBusy / setError boilerplate while keeping its error inline.
 */
export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run, setError };
}
