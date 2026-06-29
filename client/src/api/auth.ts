import { apiFetch, setToken, setStoredUser, getStoredUser, clearSession } from './client';
import type { AuthUser } from '../types';

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
  setStoredUser(user);
  return user;
}

export function logout(): void {
  clearSession();
}

export function loadStoredUser(): AuthUser | null {
  return getStoredUser<AuthUser>();
}

/**
 * Re-fetch the current user from the server (role is derived live from the DB),
 * so a refreshed page reflects a changed role (e.g. a demoted crew lead).
 */
export async function fetchMe(): Promise<AuthUser> {
  const { user } = await apiFetch<{ user: AuthUser }>('/api/auth/me');
  setStoredUser(user);
  return user;
}

/**
 * Exchange the current (still-valid) token for a fresh one to keep an active
 * session alive past the 1-hour expiry. Also resyncs the user's live role.
 */
export async function refreshToken(): Promise<AuthUser> {
  const { token, user } = await apiFetch<LoginResponse>('/api/auth/refresh', {
    method: 'POST',
  });
  setToken(token);
  setStoredUser(user);
  return user;
}
