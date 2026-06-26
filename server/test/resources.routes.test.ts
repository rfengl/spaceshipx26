import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

import { createDatabase, migrate } from '../src/db/index.js';
import { seedDatabase, DEMO_PASSWORD } from '../src/db/seed.js';
import { buildContainer } from '../src/container.js';
import { createApp } from '../src/app.js';

const withServer = async (app: Express, fn: (base: string) => Promise<void>): Promise<void> => {
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

test('crew lead can create, read, update, and delete a resource', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');

    // Create
    const created = await fetch(`${base}/api/resources`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ name: 'Star Lounge', minLevel: 'GOLD', maxQty: 12 }),
    });
    assert.equal(created.status, 201);
    const { data: resource } = await created.json();
    assert.equal(resource.minLevel, 'GOLD');
    assert.equal(resource.maxQty, 12);
    assert.equal(resource.active, true);

    // Read (seed has 7 + this one)
    const list = await fetch(`${base}/api/resources`, { headers: authJson(token) });
    const { data: all } = await list.json();
    assert.equal(all.length, 8);

    // Update
    const updated = await fetch(`${base}/api/resources/${resource.id}`, {
      method: 'PUT',
      headers: authJson(token),
      body: JSON.stringify({ minLevel: 'PLATINUM', active: false }),
    });
    assert.equal(updated.status, 200);
    const { data: changed } = await updated.json();
    assert.equal(changed.minLevel, 'PLATINUM');
    assert.equal(changed.active, false);

    // Delete
    const del = await fetch(`${base}/api/resources/${resource.id}`, {
      method: 'DELETE',
      headers: authJson(token),
    });
    assert.equal(del.status, 204);
  });
});

test('create rejects an invalid membership tier with 400', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const res = await fetch(`${base}/api/resources`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ name: 'X', minLevel: 'BRONZE', maxQty: 1 }),
    });
    assert.equal(res.status, 400);
  });
});

test('a passenger can read but cannot mutate resources (403)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'nova.reyes');

    const list = await fetch(`${base}/api/resources`, { headers: authJson(token) });
    assert.equal(list.status, 200);

    const create = await fetch(`${base}/api/resources`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ name: 'Nope', minLevel: 'SILVER', maxQty: 1 }),
    });
    assert.equal(create.status, 403);
  });
});

test('resource routes require authentication (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/resources`);
    assert.equal(res.status, 401);
  });
});
