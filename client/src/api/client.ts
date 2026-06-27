const TOKEN_KEY = 'prms_token';
const USER_KEY = 'prms_user';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

export interface ApiError extends Error {
  status: number;
}

/** Fetch wrapper that attaches the JWT and unwraps the API's error shape. */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    // An expired/invalid token on an authenticated request → clear the session
    // and bounce back to the login page.
    if (res.status === 401 && token) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.reload();
    }

    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // no JSON body
    }
    const err = new Error(message) as ApiError;
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
