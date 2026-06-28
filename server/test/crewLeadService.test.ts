import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import { createDatabase, migrate, type DB } from '../src/db/index.js';
import { CrewLeadService } from '../src/application/crewLeadService.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteChangeRequestRepository } from '../src/infrastructure/sqlite/sqliteChangeRequestRepository.js';
import type { User } from '../src/domain/models.js';

let db: DB;
let users: SqliteUserRepository;
let requests: SqliteChangeRequestRepository;
let service: CrewLeadService;

// Three crew leads (the fixed complement) plus two passengers to swap in.
let crewA: User;
let crewB: User;
let crewC: User;
let novaPassenger: User;
let priyaPassenger: User;

const makeUser = (username: string, isCrewLead: boolean): User =>
  users.create({
    username,
    passwordHash: `hashed:${username}`,
    name: username,
    membershipLevel: 'SILVER',
    isCrewLead,
  });

const expectStatus = (status: number) => (err: { status?: number }) => {
  assert.equal(err.status, status);
  return true;
};

beforeEach(() => {
  db = createDatabase(':memory:');
  migrate(db);
  users = new SqliteUserRepository(db);
  requests = new SqliteChangeRequestRepository(db);
  service = new CrewLeadService(users, requests, db);

  crewA = makeUser('crew.a', true);
  crewB = makeUser('crew.b', true);
  crewC = makeUser('crew.c', true);
  novaPassenger = makeUser('nova', false);
  priyaPassenger = makeUser('priya', false);
});

test('the ship starts with exactly three crew leads', () => {
  assert.equal(users.countCrewLeads(), 3);
});

test('a non-crew-lead cannot propose a swap (403)', () => {
  assert.throws(
    () => service.propose(novaPassenger.id, crewA.id, priyaPassenger.id),
    expectStatus(403),
  );
});

test('a proposer cannot propose to demote themselves (400)', () => {
  assert.throws(
    () => service.propose(crewA.id, crewA.id, novaPassenger.id),
    expectStatus(400),
  );
});

test('demote and promote must be different people (400)', () => {
  assert.throws(() => service.propose(crewA.id, crewB.id, crewB.id), expectStatus(400));
});

test('the person to demote must currently be a crew lead (400)', () => {
  assert.throws(
    () => service.propose(crewA.id, novaPassenger.id, priyaPassenger.id),
    expectStatus(400),
  );
});

test('the person to promote must not already be a crew lead (400)', () => {
  assert.throws(() => service.propose(crewA.id, crewB.id, crewC.id), expectStatus(400));
});

test('only one change request may be pending at a time (409)', () => {
  service.propose(crewA.id, crewB.id, novaPassenger.id);
  assert.throws(
    () => service.propose(crewA.id, crewC.id, priyaPassenger.id),
    expectStatus(409),
  );
});

test('approval by a different crew lead applies the 1-for-1 swap, count stays 3', () => {
  const request = service.propose(crewA.id, crewB.id, novaPassenger.id);
  const resolved = service.approve(request.id, crewC.id);

  assert.equal(resolved.status, 'APPROVED');
  assert.equal(users.countCrewLeads(), 3);
  assert.equal(users.findById(crewB.id)?.isCrewLead, false);
  assert.equal(users.findById(novaPassenger.id)?.isCrewLead, true);
});

test('the proposer cannot approve their own request (403)', () => {
  const request = service.propose(crewA.id, crewB.id, novaPassenger.id);
  assert.throws(() => service.approve(request.id, crewA.id), expectStatus(403));

  // The swap must not have happened.
  assert.equal(users.countCrewLeads(), 3);
  assert.equal(users.findById(crewB.id)?.isCrewLead, true);
  assert.equal(users.findById(novaPassenger.id)?.isCrewLead, false);
});

test('a passenger cannot approve a request (403)', () => {
  const request = service.propose(crewA.id, crewB.id, novaPassenger.id);
  assert.throws(() => service.approve(request.id, priyaPassenger.id), expectStatus(403));
});

test('rejecting a request leaves the crew complement unchanged', () => {
  const request = service.propose(crewA.id, crewB.id, novaPassenger.id);
  const resolved = service.reject(request.id, crewC.id);

  assert.equal(resolved.status, 'REJECTED');
  assert.equal(users.countCrewLeads(), 3);
  assert.equal(users.findById(crewB.id)?.isCrewLead, true);
  assert.equal(users.findById(novaPassenger.id)?.isCrewLead, false);
});

test('a resolved request can no longer be approved (409)', () => {
  const request = service.propose(crewA.id, crewB.id, novaPassenger.id);
  service.reject(request.id, crewC.id);
  assert.throws(() => service.approve(request.id, crewC.id), expectStatus(409));
});
