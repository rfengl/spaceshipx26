import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { UsageService } from '../src/application/usageService.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';
import { SqliteAuditTrailRepository } from '../src/infrastructure/sqlite/sqliteAuditTrailRepository.js';
import type { MembershipLevel } from '../src/domain/membership.js';
import type { Resource, User } from '../src/domain/models.js';

let db: DB;
let users: SqliteUserRepository;
let resources: SqliteResourceRepository;
let audit: SqliteAuditTrailRepository;
let service: UsageService;

let silver: User;
let gold: User;
let platinum: User;

const makePassenger = (username: string, tier: MembershipLevel): User =>
  users.create({
    username,
    passwordHash: `hashed:${username}`,
    name: username,
    membershipLevel: tier,
    isCrewLead: false,
  });

const makeResource = (
  name: string,
  minLevel: MembershipLevel,
  maxQty: number,
  remainingQty = maxQty,
): Resource => resources.create({ name, minLevel, maxQty, remainingQty });

const expectStatus = (status: number) => (err: { status?: number }) => {
  assert.equal(err.status, status);
  return true;
};

beforeEach(() => {
  db = createDatabase(':memory:');
  migrate(db);
  users = new SqliteUserRepository(db);
  resources = new SqliteResourceRepository(db);
  audit = new SqliteAuditTrailRepository(db);
  service = new UsageService(users, resources, audit, db);

  silver = makePassenger('silver', 'SILVER');
  gold = makePassenger('gold', 'GOLD');
  platinum = makePassenger('platinum', 'PLATINUM');
});

test('listAvailable returns only resources the tier can reach (inheritance)', () => {
  makeResource('Food Station', 'SILVER', 5);
  makeResource('Medical Bay', 'GOLD', 5);
  makeResource('VIP Rec Deck', 'PLATINUM', 5);

  const tiers = (user: User) =>
    service
      .listAvailable(user.id)
      .map((r) => r.minLevel)
      .sort();

  assert.deepEqual(tiers(silver), ['SILVER']);
  assert.deepEqual(tiers(gold), ['GOLD', 'SILVER']);
  assert.deepEqual(tiers(platinum), ['GOLD', 'PLATINUM', 'SILVER']);
});

test('listAvailable still lists decommissioned resources (flagged, not hidden)', () => {
  const pod = makeResource('Sleeping Pod', 'SILVER', 5);
  resources.decommission(pod.id);
  const visible = service.listAvailable(silver.id).map((r) => r.id);
  assert.ok(visible.includes(pod.id));
});

test('listAvailable rejects an unknown user (401)', () => {
  assert.throws(() => service.listAvailable('ghost'), expectStatus(401));
});

test('use rejects a resource above the user tier (403)', () => {
  const medical = makeResource('Medical Bay', 'GOLD', 5);
  assert.throws(() => service.use(silver.id, medical.id), expectStatus(403));
});

test('use rejects an out-of-stock resource (409)', () => {
  const empty = makeResource('Food Station', 'SILVER', 5, 0);
  assert.throws(() => service.use(silver.id, empty.id), expectStatus(409));
});

test('use rejects a decommissioned resource (409)', () => {
  const pod = makeResource('Sleeping Pod', 'SILVER', 5);
  resources.decommission(pod.id);
  assert.throws(() => service.use(silver.id, pod.id), expectStatus(409));
});

test('use rejects an unknown resource (404) and an unknown user (401)', () => {
  const food = makeResource('Food Station', 'SILVER', 5);
  assert.throws(() => service.use(silver.id, 'nope'), expectStatus(404));
  assert.throws(() => service.use('ghost', food.id), expectStatus(401));
});

test('use decrements remaining stock and records a USE audit entry', () => {
  const food = makeResource('Food Station', 'SILVER', 5);
  const { resource } = service.use(silver.id, food.id);

  assert.equal(resource.remainingQty, 4);
  assert.equal(resources.findById(food.id)?.remainingQty, 4);

  const entries = audit.findByResource(food.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'USE');
  assert.equal(entries[0].userId, silver.id);
  assert.equal(entries[0].amount, 1);
});

test('highDemand ranks resources by number of uses, highest first', () => {
  const food = makeResource('Food Station', 'SILVER', 10);
  const water = makeResource('Water', 'SILVER', 10);

  service.use(platinum.id, food.id);
  service.use(platinum.id, food.id);
  service.use(platinum.id, water.id);

  const ranked = service.highDemand(10);
  assert.equal(ranked[0].resource.id, food.id);
  assert.equal(ranked[0].uses, 2);
  assert.equal(ranked[1].resource.id, water.id);
  assert.equal(ranked[1].uses, 1);
});

test('shortages lists in-service resources by lowest remaining ratio first', () => {
  const low = makeResource('Almost Empty', 'SILVER', 10, 1); // ratio 0.1
  const high = makeResource('Nearly Full', 'SILVER', 10, 9); // ratio 0.9
  const decommissioned = makeResource('Out of Service', 'SILVER', 10, 0);
  resources.decommission(decommissioned.id);

  const result = service.shortages(10).map((r) => r.id);
  assert.equal(result[0], low.id);
  assert.equal(result[1], high.id);
  assert.ok(!result.includes(decommissioned.id), 'decommissioned stock is excluded');
});
