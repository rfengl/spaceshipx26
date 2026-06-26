import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthService } from '../src/application/authService.js';
import type { NewUser, User } from '../src/domain/models.js';
import type { PasswordHasher } from '../src/domain/ports/passwordHasher.js';
import type { TokenService } from '../src/domain/ports/tokenService.js';
import type { UserRepository } from '../src/domain/ports/userRepository.js';

// --- Lightweight fakes (pure unit test, no DB / bcrypt / jwt) ---

class FakeUserRepository implements UserRepository {
  private readonly byUsername = new Map<string, User>();

  seed(user: User) {
    this.byUsername.set(user.username, user);
  }
  create(input: NewUser): User {
    const user: User = { id: 'u1', createdAt: 'now', ...input };
    this.byUsername.set(user.username, user);
    return user;
  }
  findByUsername(username: string): User | null {
    return this.byUsername.get(username) ?? null;
  }
  findById(): User | null {
    return null;
  }
}

const fakeHasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  compare: async (plain, hash) => hash === `hashed:${plain}`,
};

const fakeTokens: TokenService = {
  sign: (user) => `token-for-${user.username}`,
  verify: () => {
    throw new Error('not used');
  },
};

const makeService = () => {
  const users = new FakeUserRepository();
  users.seed({
    id: 'cl1',
    username: 'ada.lovelace',
    passwordHash: 'hashed:mars2026',
    role: 'CREW_LEAD',
    crewLeadId: 'cl1',
    createdAt: 'now',
  });
  return { service: new AuthService(users, fakeHasher, fakeTokens), users };
};

test('login returns a token and safe user on valid credentials', async () => {
  const { service } = makeService();
  const result = await service.login('ada.lovelace', 'mars2026');

  assert.equal(result.token, 'token-for-ada.lovelace');
  assert.equal(result.user.role, 'CREW_LEAD');
  assert.equal(result.user.username, 'ada.lovelace');
  assert.ok(!('passwordHash' in result.user), 'never leaks the password hash');
});

test('login rejects a wrong password with 401', async () => {
  const { service } = makeService();
  await assert.rejects(service.login('ada.lovelace', 'wrong'), (err: { status?: number }) => {
    assert.equal(err.status, 401);
    return true;
  });
});

test('login rejects an unknown user with 401', async () => {
  const { service } = makeService();
  await assert.rejects(service.login('ghost', 'mars2026'), (err: { status?: number }) => {
    assert.equal(err.status, 401);
    return true;
  });
});
