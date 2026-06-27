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

test('crew lead can create, read, and update a resource', async () => {
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
    assert.equal(resource.isDecommissioned, false);

    // Read (seed has 7 + this one)
    const list = await fetch(`${base}/api/resources`, { headers: authJson(token) });
    const { data: all } = await list.json();
    assert.equal(all.length, 8);

    // Update
    const updated = await fetch(`${base}/api/resources/${resource.id}`, {
      method: 'PUT',
      headers: authJson(token),
      body: JSON.stringify({ minLevel: 'PLATINUM', isDecommissioned: true }),
    });
    assert.equal(updated.status, 200);
    const { data: changed } = await updated.json();
    assert.equal(changed.minLevel, 'PLATINUM');
    assert.equal(changed.isDecommissioned, true); // decommission = soft delete
  });
});

test('deleting a resource is a soft delete: hidden from the list, row preserved', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');

    const created = await fetch(`${base}/api/resources`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ name: 'Scrap Bay', minLevel: 'SILVER', maxQty: 3 }),
    });
    const { data: resource } = await created.json();

    const del = await fetch(`${base}/api/resources/${resource.id}`, {
      method: 'DELETE',
      headers: authJson(token),
    });
    assert.equal(del.status, 204);

    // Gone from the crew list (seed 7 remain), and a second delete now 404s
    // because the row is filtered out — but it still exists in the database.
    const list = await fetch(`${base}/api/resources`, { headers: authJson(token) });
    const { data: all } = await list.json();
    assert.equal(all.length, 7);
    assert.ok(!all.some((r: { id: string }) => r.id === resource.id));
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

test('a passenger cannot access resources at all (403)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'nova.reyes');

    const list = await fetch(`${base}/api/resources`, { headers: authJson(token) });
    assert.equal(list.status, 403);

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

const findResource = async (base: string, token: string, name: string) => {
  const { data } = await (
    await fetch(`${base}/api/resources`, { headers: authJson(token) })
  ).json();
  return data.find((r: { name: string }) => r.name === name);
};

test('crew lead can refill a resource, capped at its maximum', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const cabin = await findResource(base, token, 'Private Cabin'); // 3 / 10

    const ok = await fetch(`${base}/api/resources/${cabin.id}/refill`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ amount: 5 }),
    });
    assert.equal(ok.status, 200);
    const { data: refilled } = await ok.json();
    assert.equal(refilled.remainingQty, 8); // 3 + 5

    // Refilling beyond the max (8 + 5 > 10) is rejected and leaves stock intact.
    const tooMuch = await fetch(`${base}/api/resources/${cabin.id}/refill`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ amount: 5 }),
    });
    assert.equal(tooMuch.status, 400);
    const after = await findResource(base, token, 'Private Cabin');
    assert.equal(after.remainingQty, 8);
  });
});

test('refill rejects a non-positive amount (400)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const cabin = await findResource(base, token, 'Private Cabin');
    const res = await fetch(`${base}/api/resources/${cabin.id}/refill`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ amount: 0 }),
    });
    assert.equal(res.status, 400);
  });
});

test('a passenger cannot refill resources (403) and unauth is rejected (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const crew = await tokenFor(base, 'ada.lovelace');
    const cabin = await findResource(base, crew, 'Private Cabin');

    const passenger = await tokenFor(base, 'nova.reyes');
    assert.equal(
      (
        await fetch(`${base}/api/resources/${cabin.id}/refill`, {
          method: 'POST',
          headers: authJson(passenger),
          body: JSON.stringify({ amount: 1 }),
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(`${base}/api/resources/${cabin.id}/refill`, { method: 'POST' }))
        .status,
      401,
    );
  });
});

test('crew lead can write off stock; cannot exceed remaining; logged with reason', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const cabin = await findResource(base, token, 'Private Cabin'); // 3 / 10

    const ok = await fetch(`${base}/api/resources/${cabin.id}/write-off`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ amount: 2, reason: 'Expired' }),
    });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).data.remainingQty, 1); // 3 - 2

    // Writing off more than what's left (2 > 1) is rejected, stock untouched.
    const tooMuch = await fetch(`${base}/api/resources/${cabin.id}/write-off`, {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ amount: 2 }),
    });
    assert.equal(tooMuch.status, 400);
    assert.equal((await findResource(base, token, 'Private Cabin')).remainingQty, 1);

    // The write-off is in the audit trail with its amount and reason.
    const { data: trail } = await (
      await fetch(`${base}/api/reports/audit`, { headers: authJson(token) })
    ).json();
    const entry = trail.find(
      (e: { type: string; resourceId: string }) =>
        e.type === 'WRITE_OFF' && e.resourceId === cabin.id,
    );
    assert.ok(entry, 'write-off is recorded');
    assert.equal(entry.amount, 2);
    assert.equal(entry.note, 'Expired');
  });
});

test('editing max quantity below current remaining stock is rejected (400)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const food = await findResource(base, token, 'Food Supply Station'); // 18 / 20

    // Lowering the cap below the 18 already in stock would overflow capacity.
    const res = await fetch(`${base}/api/resources/${food.id}`, {
      method: 'PUT',
      headers: authJson(token),
      body: JSON.stringify({ maxQty: 10 }),
    });
    assert.equal(res.status, 400);
    // Stock and capacity are untouched.
    const after = await findResource(base, token, 'Food Supply Station');
    assert.equal(after.maxQty, 20);
    assert.equal(after.remainingQty, 18);

    // Lowering to exactly the remaining stock is allowed.
    const ok = await fetch(`${base}/api/resources/${food.id}`, {
      method: 'PUT',
      headers: authJson(token),
      body: JSON.stringify({ maxQty: 18 }),
    });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).data.maxQty, 18);
  });
});

test('a passenger cannot write off resources (403)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const crew = await tokenFor(base, 'ada.lovelace');
    const cabin = await findResource(base, crew, 'Private Cabin');
    const passenger = await tokenFor(base, 'nova.reyes');
    assert.equal(
      (
        await fetch(`${base}/api/resources/${cabin.id}/write-off`, {
          method: 'POST',
          headers: authJson(passenger),
          body: JSON.stringify({ amount: 1, reason: 'Broken' }),
        })
      ).status,
      403,
    );
  });
});
