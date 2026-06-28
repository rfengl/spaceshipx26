import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { login, logout, loadStoredUser } from '../../src/api/auth';
import type { AuthUser } from '../../src/types';

const TOKEN_KEY = 'prms_token';
const USER_KEY = 'prms_user';
const user: AuthUser = { id: '1', username: 'ada', role: 'CREW_LEAD' };

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('loadStoredUser', () => {
  it('returns the stored user when the JSON is valid', () => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    expect(loadStoredUser()).toEqual(user);
  });

  it('returns null when nothing is stored', () => {
    expect(loadStoredUser()).toBeNull();
  });

  it('returns null (does not throw) when the stored value is corrupt', () => {
    localStorage.setItem(USER_KEY, '{not valid json');
    expect(loadStoredUser()).toBeNull();
  });
});

describe('login / logout', () => {
  it('stores the token and user and returns the user', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 't1', user }),
    });

    const result = await login('ada', 'pw');

    expect(result).toEqual(user);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('t1');
    expect(JSON.parse(localStorage.getItem(USER_KEY)!)).toEqual(user);
  });

  it('clears the token and user on logout', () => {
    localStorage.setItem(TOKEN_KEY, 't1');
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    logout();

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });
});
