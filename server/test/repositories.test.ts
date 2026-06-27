import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';
import { SqliteUsageLogRepository } from '../src/infrastructure/sqlite/sqliteUsageLogRepository.js';

let db: DB;

beforeEach(() => {
  db = createDatabase(':memory:');
  migrate(db);
});

test('user repository separates passengers from crew leads', () => {
  const users = new SqliteUserRepository(db);
  users.create({
    username: 'ada',
    passwordHash: 'h',
    name: 'Ada',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
  });
  const passenger = users.create({
    username: 'nova',
    passwordHash: 'h',
    name: 'Nova',
    membershipLevel: 'SILVER',
    isCrewLead: false,
  });

  assert.equal(users.countCrewLeads(), 1);
  assert.equal(users.findCrewLeads().length, 1);
  assert.equal(users.findPassengers().length, 1);
  assert.equal(users.findByUsername('nova')?.id, passenger.id);
});

test('setCrewLead toggles crew-lead status', () => {
  const users = new SqliteUserRepository(db);
  const u = users.create({
    username: 'milo',
    passwordHash: 'h',
    name: 'Milo',
    membershipLevel: 'GOLD',
    isCrewLead: false,
  });
  users.setCrewLead(u.id, true);
  assert.equal(users.findById(u.id)?.isCrewLead, true);
  assert.equal(users.countCrewLeads(), 1);
  assert.equal(users.findPassengers().length, 0);
});

test('resource repository: active filter and decommission', () => {
  const repo = new SqliteResourceRepository(db);
  const pod = repo.create({ name: 'Luxury O2 Pod', minLevel: 'PLATINUM', maxQty: 8 });
  repo.create({ name: 'Food Station', minLevel: 'SILVER', maxQty: 20 });

  assert.equal(repo.findActive().length, 2);
  repo.deactivate(pod.id);
  assert.equal(repo.findActive().length, 1);
  assert.equal(repo.findAll().length, 2);
});

test('membership_level CHECK constraint rejects invalid tiers', () => {
  assert.throws(() =>
    db
      .prepare(
        `INSERT INTO users (id, username, password_hash, name, membership_level, is_crew_lead, created_at)
         VALUES ('x','u','h','N','BRONZE',0,'now')`,
      )
      .run(),
  );
});

test('usage log records usage and cascades when the user is deleted', () => {
  const users = new SqliteUserRepository(db);
  const resources = new SqliteResourceRepository(db);
  const usage = new SqliteUsageLogRepository(db);

  const u = users.create({
    username: 'tomas',
    passwordHash: 'h',
    name: 'Tomas',
    membershipLevel: 'GOLD',
    isCrewLead: false,
  });
  const r = resources.create({ name: 'Adv. Medical Bay', minLevel: 'GOLD', maxQty: 5 });

  usage.record({ userId: u.id, resourceId: r.id });
  assert.equal(usage.findByUser(u.id).length, 1);

  users.delete(u.id);
  assert.equal(usage.findAll().length, 0); // ON DELETE CASCADE
});
