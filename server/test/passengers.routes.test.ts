import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

import { createDatabase, migrate } from '../src/db/index.js';
import { seedDatabase, DEMO_PASSWORD } from '../src/db/seed.js';
import { buildContainer } from '../src/container.js';
import { createApp } from '../src/app.js';

const withServer = async (
  app: Express,
  fn: (base: string) => Promise<void>,
): Promise<void> => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const buildSeededApp = async () => {
  const db = createDatabase(':memory:');
  migrate(db);
  const container = buildContainer(db);
  await seedDatabase(db, container.passwordHasher);
  return createApp(container);
};

const tokenFor = async (base: string, username: string): Promise<string> => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: DEMO_PASSWORD }),
  });
  return (await res.json()).token;
};

const authJson = (token: string) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
});

test('crew lead can create, read, update, and delete a passenger', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');

    const created = await fetch(`${base}/api/passengers`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({
        username: 'zoe.quark',
        password: 'mars2026',
        name: 'Zoe Quark',
        membershipLevel: 'SILVER',
      }),
    });
    assert.equal(created.status, 201);
    const { data: passenger } = await created.json();
    assert.equal(passenger.membershipLevel, 'SILVER');
    assert.equal(passenger.isCrewLead, false);
    assert.equal(passenger.passwordHash, undefined);

    // Seed has 6 passengers + this one (crew leads excluded from the list)
    const list = await fetch(`${base}/api/passengers`, { headers: authJson(token) });
    const { data: all } = await list.json();
    assert.equal(all.length, 7);

    const updated = await fetch(`${base}/api/passengers/${passenger.id}`, {
      method: 'PUT',
      headers: authJson(token),
      body: JSON.stringify({ membershipLevel: 'PLATINUM' }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).data.membershipLevel, 'PLATINUM');

    const del = await fetch(`${base}/api/passengers/${passenger.id}`, {
      method: 'DELETE',
      headers: authJson(token),
    });
    assert.equal(del.status, 204);
  });
});

test('create rejects an invalid tier (400) and a duplicate username (409)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');

    const badTier = await fetch(`${base}/api/passengers`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({
        username: 'x.y',
        password: 'mars2026',
        name: 'X',
        membershipLevel: 'BRONZE',
      }),
    });
    assert.equal(badTier.status, 400);

    const dup = await fetch(`${base}/api/passengers`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({
        username: 'nova.reyes', // already seeded
        password: 'mars2026',
        name: 'Nova Two',
        membershipLevel: 'SILVER',
      }),
    });
    assert.equal(dup.status, 409);
  });
});

test('a passenger cannot access passenger management at all (403)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'nova.reyes');

    const list = await fetch(`${base}/api/passengers`, { headers: authJson(token) });
    assert.equal(list.status, 403);

    const create = await fetch(`${base}/api/passengers`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({
        username: 'nope',
        password: 'mars2026',
        name: 'Nope',
        membershipLevel: 'SILVER',
      }),
    });
    assert.equal(create.status, 403);
  });
});

test('passenger routes require authentication (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    assert.equal((await fetch(`${base}/api/passengers`)).status, 401);
  });
});
