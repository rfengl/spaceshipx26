import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { SqliteCrewLeadRepository } from '../src/infrastructure/sqlite/sqliteCrewLeadRepository.js';
import { SqlitePassengerRepository } from '../src/infrastructure/sqlite/sqlitePassengerRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';
import { SqliteUsageLogRepository } from '../src/infrastructure/sqlite/sqliteUsageLogRepository.js';

let db: DB;

beforeEach(() => {
  // Fresh in-memory database per test for isolation.
  db = createDatabase(':memory:');
  migrate(db);
});

test('crew lead repository: create, count, delete', () => {
  const repo = new SqliteCrewLeadRepository(db);
  const a = repo.create({ name: 'Ada' });
  repo.create({ name: 'Grace' });

  assert.equal(repo.count(), 2);
  assert.equal(repo.findById(a.id)?.name, 'Ada');
  assert.equal(repo.delete(a.id), true);
  assert.equal(repo.count(), 1);
});

test('passenger repository: create and change membership tier', () => {
  const repo = new SqlitePassengerRepository(db);
  const p = repo.create({ name: 'Nova', membershipLevel: 'SILVER' });

  assert.equal(p.membershipLevel, 'SILVER');
  assert.equal(p.updatedAt, undefined);

  const upgraded = repo.setMembershipLevel(p.id, 'GOLD');
  assert.equal(upgraded?.membershipLevel, 'GOLD');
  assert.ok(upgraded?.updatedAt, 'updatedAt is set after a tier change');
  assert.equal(repo.findById(p.id)?.membershipLevel, 'GOLD');
});

test('resource repository: active filter and decommission', () => {
  const repo = new SqliteResourceRepository(db);
  const pod = repo.create({ name: 'Luxury O2 Pod', minLevel: 'PLATINUM', maxQty: 8 });
  repo.create({ name: 'Food Station', minLevel: 'SILVER', maxQty: 20 });

  assert.equal(repo.findActive().length, 2);
  const decommissioned = repo.deactivate(pod.id);
  assert.equal(decommissioned?.active, false);
  assert.equal(repo.findActive().length, 1);
  assert.equal(repo.findAll().length, 2);
});

test('membership_level CHECK constraint rejects invalid tiers', () => {
  assert.throws(() =>
    db
      .prepare('INSERT INTO passengers (id, name, membership_level, created_at) VALUES (?, ?, ?, ?)')
      .run('x', 'Bad', 'BRONZE', new Date().toISOString()),
  );
});

test('usage log repository records usage and cascades on passenger delete', () => {
  const passengers = new SqlitePassengerRepository(db);
  const resources = new SqliteResourceRepository(db);
  const usage = new SqliteUsageLogRepository(db);

  const p = passengers.create({ name: 'Nova', membershipLevel: 'GOLD' });
  const r = resources.create({ name: 'Adv. Medical Bay', minLevel: 'GOLD', maxQty: 5 });

  usage.record({ passengerId: p.id, resourceId: r.id });
  usage.record({ passengerId: p.id, resourceId: r.id });

  assert.equal(usage.findByPassenger(p.id).length, 2);
  assert.equal(usage.findAll().length, 2);

  // ON DELETE CASCADE removes the passenger's logs.
  passengers.delete(p.id);
  assert.equal(usage.findByPassenger(p.id).length, 0);
});
