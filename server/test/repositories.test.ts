import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';
import { SqliteAuditTrailRepository } from '../src/infrastructure/sqlite/sqliteAuditTrailRepository.js';
import { InventoryService } from '../src/application/inventoryService.js';

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

test('resource repository: decommission (flagged, visible) vs soft delete (hidden)', () => {
  const repo = new SqliteResourceRepository(db);
  const pod = repo.create({ name: 'Luxury O2 Pod', minLevel: 'PLATINUM', maxQty: 8 });
  const food = repo.create({ name: 'Food Station', minLevel: 'SILVER', maxQty: 20 });

  assert.equal(repo.findInService().length, 2);

  // Decommission: out of service but still listed (active = 1, flagged).
  const decommissioned = repo.decommission(pod.id);
  assert.equal(decommissioned?.isDecommissioned, true);
  assert.equal(decommissioned?.active, true);
  assert.equal(repo.findInService().length, 1);
  assert.equal(repo.findAll().length, 2);

  // Soft delete: hidden from both lists, but the row is preserved.
  const deleted = repo.deactivate(food.id);
  assert.equal(deleted?.active, false);
  assert.equal(repo.findAll().length, 1);
  assert.equal(repo.findInService().length, 0);
  assert.equal(repo.findById(food.id)?.active, false); // row still there
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

test('addRemaining tops up stock but never above the maximum', () => {
  const repo = new SqliteResourceRepository(db);
  const pod = repo.create({
    name: 'O2 Pod',
    minLevel: 'PLATINUM',
    maxQty: 8,
    remainingQty: 3,
  });

  assert.equal(repo.addRemaining(pod.id, 4)?.remainingQty, 7);
  // 7 + 2 = 9 > 8, so the increment is refused atomically (null, stock unchanged).
  assert.equal(repo.addRemaining(pod.id, 2), null);
  assert.equal(repo.findById(pod.id)?.remainingQty, 7);
});

test('inventory service refills and writes an audit-trail entry', () => {
  const users = new SqliteUserRepository(db);
  const resources = new SqliteResourceRepository(db);
  const audit = new SqliteAuditTrailRepository(db);
  const inventory = new InventoryService(resources, audit, db);

  const crew = users.create({
    username: 'ada',
    passwordHash: 'h',
    name: 'Ada',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
  });
  const cabin = resources.create({
    name: 'Private Cabin',
    minLevel: 'GOLD',
    maxQty: 10,
    remainingQty: 3,
  });

  const { resource } = inventory.refill(crew.id, cabin.id, 4);
  assert.equal(resource.remainingQty, 7);

  const { entries: logs } = audit.search({ resourceId: cabin.id }, 100, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].type, 'REFILL');
  assert.equal(logs[0].userId, crew.id);
  assert.equal(logs[0].amount, 4);

  // Over-cap refill throws and leaves the audit trail untouched.
  assert.throws(() => inventory.refill(crew.id, cabin.id, 99));
  assert.equal(audit.search({ resourceId: cabin.id }, 100, 0).total, 1);
});

test('soft-deleting a user preserves history and drops them from the roster', () => {
  const users = new SqliteUserRepository(db);
  const resources = new SqliteResourceRepository(db);
  const audit = new SqliteAuditTrailRepository(db);

  const u = users.create({
    username: 'tomas',
    passwordHash: 'h',
    name: 'Tomas',
    membershipLevel: 'GOLD',
    isCrewLead: false,
  });
  const r = resources.create({ name: 'Adv. Medical Bay', minLevel: 'GOLD', maxQty: 5 });

  audit.record({ userId: u.id, resourceId: r.id, action: 'USE', amount: 1 });
  assert.equal(audit.search({ userId: u.id }, 100, 0).total, 1);
  assert.equal(users.findPassengers().length, 1);

  const deactivated = users.deactivate(u.id);
  assert.equal(deactivated?.active, false);
  // Row (and its audit history) is preserved — no hard delete, no cascade.
  assert.equal(audit.search({ userId: u.id }, 100, 0).total, 1);
  assert.equal(users.findById(u.id)?.active, false);
  // ...but they no longer appear on the active roster.
  assert.equal(users.findPassengers().length, 0);
});
