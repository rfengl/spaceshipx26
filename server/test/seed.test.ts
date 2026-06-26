import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import type { PasswordHasher } from '../src/domain/ports/passwordHasher.js';
import { SqliteCrewLeadRepository } from '../src/infrastructure/sqlite/sqliteCrewLeadRepository.js';
import { SqlitePassengerRepository } from '../src/infrastructure/sqlite/sqlitePassengerRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';

// Fast deterministic hasher so seed tests don't pay bcrypt's cost.
const fakeHasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  compare: async (plain, hash) => hash === `hashed:${plain}`,
};

const countUsers = (db: DB): number =>
  (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;

let db: DB;

beforeEach(() => {
  db = createDatabase(':memory:');
  migrate(db);
});

test('seeds 3 crew leads and 6 passengers (2 per tier)', async () => {
  const result = await seedDatabase(db, fakeHasher);
  assert.equal(result.seeded, true);

  assert.equal(new SqliteCrewLeadRepository(db).count(), 3);

  const passengers = new SqlitePassengerRepository(db).findAll();
  assert.equal(passengers.length, 6);
  const byTier = (tier: string) =>
    passengers.filter((p) => p.membershipLevel === tier).length;
  assert.equal(byTier('SILVER'), 2);
  assert.equal(byTier('GOLD'), 2);
  assert.equal(byTier('PLATINUM'), 2);
});

test('seeds the base resource inventory and a user per person', async () => {
  await seedDatabase(db, fakeHasher);
  assert.equal(new SqliteResourceRepository(db).findAll().length, 7);
  assert.equal(countUsers(db), 9); // 3 crew leads + 6 passengers
});

test('is idempotent — running twice does not duplicate', async () => {
  await seedDatabase(db, fakeHasher);
  const second = await seedDatabase(db, fakeHasher);

  assert.equal(second.seeded, false);
  assert.equal(new SqliteCrewLeadRepository(db).count(), 3);
  assert.equal(countUsers(db), 9);
});
