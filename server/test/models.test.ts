import assert from 'node:assert/strict';
import test from 'node:test';

import { toPublicUser, type User } from '../src/domain/models.js';

const sampleUser = (): User => ({
  id: 'u1',
  username: 'ada',
  passwordHash: 'secret-hash',
  name: 'Ada Lovelace',
  membershipLevel: 'PLATINUM',
  isCrewLead: true,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

test('toPublicUser strips the password hash', () => {
  const pub = toPublicUser(sampleUser());
  assert.ok(!('passwordHash' in pub), 'the password hash must never be exposed');
});

test('toPublicUser preserves every non-secret field', () => {
  const pub = toPublicUser(sampleUser());
  assert.deepEqual(pub, {
    id: 'u1',
    username: 'ada',
    name: 'Ada Lovelace',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
});

test('toPublicUser does not mutate the source user', () => {
  const user = sampleUser();
  toPublicUser(user);
  assert.equal(user.passwordHash, 'secret-hash');
});
