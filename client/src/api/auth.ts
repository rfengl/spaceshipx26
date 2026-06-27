import { apiFetch, setToken, clearToken } from './client';
import type { AuthUser } from '../types';

const USER_KEY = 'prms_user';

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const { token, user } = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function logout(): void {
  clearToken();
  localStorage.removeItem(USER_KEY);
}

export function loadStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Re-fetch the current user from the server (role is derived live from the DB),
 * so a refreshed page reflects a changed role (e.g. a demoted crew lead).
 */
export async function fetchMe(): Promise<AuthUser> {
  const { user } = await apiFetch<{ user: AuthUser }>('/api/auth/me');
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}
