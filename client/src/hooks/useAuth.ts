import { useOutletContext } from 'react-router-dom';

import type { AuthUser } from '../types';

export interface LayoutContext {
  user: AuthUser;
}

/** Access the authenticated user from within a routed page. */
export const useAuth = (): LayoutContext => useOutletContext<LayoutContext>();
