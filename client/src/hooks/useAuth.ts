import { useOutletContext } from 'react-router-dom';

import type { AuthUser } from '../types';

export interface LayoutContext {
  user: AuthUser;
  /** Re-fetch the current user from the server (e.g. after a profile change). */
  refreshUser: () => Promise<void>;
}

/** Access the authenticated user from within a routed page. */
export const useAuth = (): LayoutContext => useOutletContext<LayoutContext>();
