import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { apiFetch, setToken, getToken } from '../../src/api/client';

// A minimal stand-in for the parts of Response that apiFetch reads.
const response = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const fetchMock = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // jsdom's real location.reload throws "not implemented"; swap in a spy.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

const lastHeaders = () =>
  (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;

describe('apiFetch', () => {
  it('attaches the Bearer token when one is stored', async () => {
    setToken('jwt-123');
    fetchMock.mockResolvedValue(response(200, { ok: true }));

    await apiFetch('/api/resources');

    expect(lastHeaders().Authorization).toBe('Bearer jwt-123');
  });

  it('omits the Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(response(200, {}));
    await apiFetch('/api/resources');
    expect(lastHeaders().Authorization).toBeUndefined();
  });

  it('returns the parsed JSON body on success', async () => {
    fetchMock.mockResolvedValue(response(200, { id: 'r1', name: 'Food Station' }));
    const data = await apiFetch<{ id: string; name: string }>('/api/resources/r1');
    expect(data).toEqual({ id: 'r1', name: 'Food Station' });
  });

  it('throws an ApiError carrying the status and the API error message', async () => {
    fetchMock.mockResolvedValue(
      response(400, { error: { message: 'Refill exceeds the maximum' } }),
    );
    await assertRejects('/api/resources/r1', 400, 'Refill exceeds the maximum');
  });

  it('on a 401 with a token, clears the session and reloads to login', async () => {
    setToken('expired');
    localStorage.setItem('prms_user', JSON.stringify({ id: '1' }));
    fetchMock.mockResolvedValue(response(401, {}));

    await expect(apiFetch('/api/me/resources')).rejects.toMatchObject({ status: 401 });

    expect(getToken()).toBeNull();
    expect(localStorage.getItem('prms_user')).toBeNull();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it('on a 401 without a token (e.g. a failed login) just throws, no reload', async () => {
    // Not logged in: a wrong-password login returns 401, but there's no session
    // to clear and reloading would trap the user in a loop — it must only throw.
    fetchMock.mockResolvedValue(response(401, { error: { message: 'Invalid login' } }));

    await assertRejects('/api/auth/login', 401, 'Invalid login');

    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('returns undefined for a 204 No Content response', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => undefined });
    const result = await apiFetch('/api/passengers/p1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });
});

async function assertRejects(path: string, status: number, message: string) {
  try {
    await apiFetch(path);
    throw new Error('expected apiFetch to reject');
  } catch (err) {
    const e = err as { status?: number; message?: string };
    expect(e.status).toBe(status);
    expect(e.message).toBe(message);
  }
}
