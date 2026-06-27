import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { AuthService } from '../src/application/authService.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import type { PasswordHasher } from '../src/domain/ports/passwordHasher.js';
import type { TokenService } from '../src/domain/ports/tokenService.js';

const fakeHasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  compare: async (plain, hash) => hash === `hashed:${plain}`,
};

const fakeTokens: TokenService = {
  sign: (user) => `token-${user.username}-${user.role}`,
  verify: () => {
    throw new Error('not used');
  },
};

let db: DB;
let users: SqliteUserRepository;
let service: AuthService;

beforeEach(() => {
  db = createDatabase(':memory:');
  migrate(db);
  users = new SqliteUserRepository(db);
  service = new AuthService(users, fakeHasher, fakeTokens);
});

test('login derives CREW_LEAD role from is_crew_lead', async () => {
  users.create({
    username: 'ada',
    passwordHash: 'hashed:pw',
    name: 'Ada',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
  });
  const result = await service.login('ada', 'pw');
  assert.equal(result.user.role, 'CREW_LEAD');
  assert.equal(result.token, 'token-ada-CREW_LEAD');
  assert.ok(!('passwordHash' in result.user), 'never leaks the password hash');
});

test('login derives PASSENGER role', async () => {
  users.create({
    username: 'nova',
    passwordHash: 'hashed:pw',
    name: 'Nova',
    membershipLevel: 'SILVER',
    isCrewLead: false,
  });
  const result = await service.login('nova', 'pw');
  assert.equal(result.user.role, 'PASSENGER');
});

test('login rejects a wrong password with 401', async () => {
  users.create({
    username: 'ada',
    passwordHash: 'hashed:pw',
    name: 'Ada',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
  });
  await assert.rejects(service.login('ada', 'wrong'), (err: { status?: number }) => {
    assert.equal(err.status, 401);
    return true;
  });
});

test('login rejects an unknown user with 401', async () => {
  await assert.rejects(service.login('ghost', 'pw'), (err: { status?: number }) => {
    assert.equal(err.status, 401);
    return true;
  });
});
