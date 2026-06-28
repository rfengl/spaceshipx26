import assert from 'node:assert/strict';
import test from 'node:test';

import { JwtTokenService } from '../src/infrastructure/security/jwtTokenService.js';
import type { AuthUser } from '../src/domain/models.js';

const SECRET = 'test-secret';
const user: AuthUser = { id: 'u1', username: 'ada', role: 'CREW_LEAD' };

const service = new JwtTokenService(SECRET, '1h');

test('sign then verify round-trips the identity (sub → id)', () => {
  const token = service.sign(user);
  assert.deepEqual(service.verify(token), user);
});

test('a token signed with a different secret is rejected', () => {
  const token = new JwtTokenService('other-secret', '1h').sign(user);
  assert.throws(() => service.verify(token));
});

test('a tampered token is rejected', () => {
  const parts = service.sign(user).split('.');
  // Flip the last character of the signature segment.
  parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('A') ? 'B' : 'A');
  assert.throws(() => service.verify(parts.join('.')));
});

test('a malformed token is rejected', () => {
  assert.throws(() => service.verify('not-a-jwt'));
});

test('an expired token is rejected', () => {
  // expiresIn in the past → the token is already expired when verified.
  const expired = new JwtTokenService(SECRET, '-1s').sign(user);
  assert.throws(() => service.verify(expired), /expired/i);
});
