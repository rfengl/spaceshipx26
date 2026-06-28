import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { InventoryService } from '../src/application/inventoryService.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';
import { SqliteAuditTrailRepository } from '../src/infrastructure/sqlite/sqliteAuditTrailRepository.js';
import type { MembershipLevel } from '../src/domain/membership.js';
import type { Resource, User } from '../src/domain/models.js';

let db: DB;
let users: SqliteUserRepository;
let resources: SqliteResourceRepository;
let audit: SqliteAuditTrailRepository;
let service: InventoryService;
let crew: User;

const makeResource = (
  name: string,
  maxQty: number,
  remainingQty: number,
  minLevel: MembershipLevel = 'SILVER',
): Resource => resources.create({ name, minLevel, maxQty, remainingQty });

const expectStatus = (status: number) => (err: { status?: number }) => {
  assert.equal(err.status, status);
  return true;
};

const lastEntryFor = (resourceId: string) => {
  const entries = audit.findByResource(resourceId);
  return entries[entries.length - 1];
};

beforeEach(() => {
  db = createDatabase(':memory:');
  migrate(db);
  users = new SqliteUserRepository(db);
  resources = new SqliteResourceRepository(db);
  audit = new SqliteAuditTrailRepository(db);
  service = new InventoryService(resources, audit, db);

  crew = users.create({
    username: 'crew',
    passwordHash: 'hashed:crew',
    name: 'Crew',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
  });
});

// --- refill ---

test('refill rejects a non-positive or non-integer amount (400)', () => {
  const r = makeResource('Food Station', 10, 3);
  assert.throws(() => service.refill(crew.id, r.id, 0), expectStatus(400));
  assert.throws(() => service.refill(crew.id, r.id, -2), expectStatus(400));
  assert.throws(() => service.refill(crew.id, r.id, 1.5), expectStatus(400));
});

test('refill cannot exceed the maximum quantity (400)', () => {
  const r = makeResource('Food Station', 10, 8);
  assert.throws(() => service.refill(crew.id, r.id, 5), expectStatus(400)); // only room for 2
});

test('refill rejects a decommissioned resource (409) and an unknown one (404)', () => {
  const pod = makeResource('Sleeping Pod', 10, 2);
  resources.decommission(pod.id);
  assert.throws(() => service.refill(crew.id, pod.id, 1), expectStatus(409));
  assert.throws(() => service.refill(crew.id, 'nope', 1), expectStatus(404));
});

test('refill adds stock (up to the cap) and records a REFILL audit entry', () => {
  const r = makeResource('Food Station', 10, 3);
  const { resource } = service.refill(crew.id, r.id, 4);

  assert.equal(resource.remainingQty, 7);
  assert.equal(resources.findById(r.id)?.remainingQty, 7);

  const entry = lastEntryFor(r.id);
  assert.equal(entry.type, 'REFILL');
  assert.equal(entry.amount, 4);
  assert.equal(entry.userId, crew.id);
});

test('refill exactly to the maximum is allowed', () => {
  const r = makeResource('Food Station', 10, 8);
  const { resource } = service.refill(crew.id, r.id, 2);
  assert.equal(resource.remainingQty, 10);
});

// --- write-off ---

test('write-off rejects a non-positive amount (400)', () => {
  const r = makeResource('Food Station', 10, 5);
  assert.throws(() => service.writeOff(crew.id, r.id, 0), expectStatus(400));
  assert.throws(() => service.writeOff(crew.id, r.id, -1), expectStatus(400));
});

test('write-off cannot exceed the remaining stock (400)', () => {
  const r = makeResource('Food Station', 10, 5);
  assert.throws(() => service.writeOff(crew.id, r.id, 6), expectStatus(400));
});

test('write-off rejects an unknown resource (404)', () => {
  assert.throws(() => service.writeOff(crew.id, 'nope', 1), expectStatus(404));
});

test('write-off decrements stock and records the reason in the audit trail', () => {
  const r = makeResource('Food Station', 10, 5);
  const { resource } = service.writeOff(crew.id, r.id, 3, '  expired  ');

  assert.equal(resource.remainingQty, 2);
  assert.equal(resources.findById(r.id)?.remainingQty, 2);

  const entry = lastEntryFor(r.id);
  assert.equal(entry.type, 'WRITE_OFF');
  assert.equal(entry.amount, 3);
  assert.equal(entry.note, 'expired'); // trimmed
});

test('write-off with a blank reason stores no note', () => {
  const r = makeResource('Food Station', 10, 5);
  service.writeOff(crew.id, r.id, 1, '   ');
  assert.equal(lastEntryFor(r.id).note, null);
});
