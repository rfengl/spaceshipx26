import assert from 'node:assert/strict';
import test from 'node:test';

import { BcryptPasswordHasher } from '../src/infrastructure/security/bcryptPasswordHasher.js';

// Fewer rounds keep the test fast; behaviour is identical.
const hasher = new BcryptPasswordHasher(4);

test('hash does not return the plaintext', async () => {
  const hash = await hasher.hash('mars2026');
  assert.notEqual(hash, 'mars2026');
  assert.ok(hash.length > 0);
});

test('compare accepts the correct password and rejects a wrong one', async () => {
  const hash = await hasher.hash('mars2026');
  assert.equal(await hasher.compare('mars2026', hash), true);
  assert.equal(await hasher.compare('wrong-password', hash), false);
});

test('the same password hashes differently each time (salted)', async () => {
  const a = await hasher.hash('same');
  const b = await hasher.hash('same');
  assert.notEqual(a, b);
  // ...yet both still verify against the original password.
  assert.equal(await hasher.compare('same', a), true);
  assert.equal(await hasher.compare('same', b), true);
});
