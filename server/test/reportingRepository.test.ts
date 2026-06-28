import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { randomUUID } from 'node:crypto';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { SqliteReportingRepository } from '../src/infrastructure/sqlite/sqliteReportingRepository.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';
import type { MembershipLevel } from '../src/domain/membership.js';

let db: DB;
let reporting: SqliteReportingRepository;
let users: SqliteUserRepository;
let resources: SqliteResourceRepository;

// ISO timestamp / YYYY-MM-DD for a point `daysAgo` before now (UTC, matching
// how the app records created_at).
const at = (daysAgo: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};
const day = (daysAgo: number): string => at(daysAgo).slice(0, 10);

const makeUser = (username: string, tier: MembershipLevel) =>
  users.create({
    username,
    passwordHash: 'h',
    name: username,
    membershipLevel: tier,
    isCrewLead: false,
  });

const makeResource = (name: string, minLevel: MembershipLevel = 'SILVER') =>
  resources.create({ name, minLevel, maxQty: 100, remainingQty: 100 });

// Insert an audit row directly so the timestamp/action can be controlled.
const record = (resourceId: string, userId: string, action: string, daysAgo: number) =>
  db
    .prepare(
      'INSERT INTO audit_trail (id, user_id, resource_id, action, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(randomUUID(), userId, resourceId, action, 1, null, at(daysAgo));

beforeEach(() => {
  db = createDatabase(':memory:');
  migrate(db);
  users = new SqliteUserRepository(db);
  resources = new SqliteResourceRepository(db);
  reporting = new SqliteReportingRepository(db);
});

test('dailyUsage groups USE events by day within the window, oldest first', () => {
  const silver = makeUser('silver', 'SILVER');
  const food = makeResource('Food Station');
  const other = makeResource('Medical Bay', 'GOLD');

  record(food.id, silver.id, 'USE', 0); // today
  record(food.id, silver.id, 'USE', 0); // today
  record(food.id, silver.id, 'USE', 3); // 3 days ago
  record(food.id, silver.id, 'USE', 40); // outside the 30-day window
  record(other.id, silver.id, 'USE', 0); // different resource

  assert.deepEqual(reporting.dailyUsage(food.id, 30), [
    { day: day(3), count: 1 },
    { day: day(0), count: 2 },
  ]);
});

test('dailyUsage counts only USE actions on the resource', () => {
  const silver = makeUser('silver', 'SILVER');
  const food = makeResource('Food Station');

  record(food.id, silver.id, 'USE', 1);
  record(food.id, silver.id, 'REFILL', 1); // a refill must not count as usage

  assert.deepEqual(reporting.dailyUsage(food.id, 30), [{ day: day(1), count: 1 }]);
});

test('usageByTier counts USE per membership tier, zero-filled across all tiers', () => {
  const silver = makeUser('silver', 'SILVER');
  const gold = makeUser('gold', 'GOLD');
  const food = makeResource('Food Station');
  const other = makeResource('Medical Bay', 'GOLD');

  record(food.id, silver.id, 'USE', 0);
  record(food.id, silver.id, 'USE', 2);
  record(food.id, gold.id, 'USE', 1);
  record(other.id, gold.id, 'USE', 0); // different resource — excluded

  assert.deepEqual(reporting.usageByTier(food.id), [
    { level: 'SILVER', uses: 2 },
    { level: 'GOLD', uses: 1 },
    { level: 'PLATINUM', uses: 0 },
  ]);
});
