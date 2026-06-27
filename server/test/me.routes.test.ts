import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

import { createDatabase, migrate } from '../src/db/index.js';
import { seedDatabase, DEMO_PASSWORD } from '../src/db/seed.js';
import { buildContainer } from '../src/container.js';
import { createApp } from '../src/app.js';
import { SqliteUsageLogRepository } from '../src/infrastructure/sqlite/sqliteUsageLogRepository.js';

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

const myResources = async (base: string, username: string) => {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: DEMO_PASSWORD }),
  });
  const { token } = await login.json();
  const res = await fetch(`${base}/api/me/resources`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return (await res.json()).data as {
    name: string;
    minLevel: string;
    maxQty: number;
    remainingQty: number;
  }[];
};

test('resource discovery is filtered by membership tier (inheritance)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    // SILVER sees only SILVER (3); GOLD sees SILVER+GOLD (5); PLATINUM sees all (7)
    assert.equal((await myResources(base, 'nova.reyes')).length, 3);
    assert.equal((await myResources(base, 'priya.anand')).length, 5);
    assert.equal((await myResources(base, 'lena.park')).length, 7);
  });
});

test('discovery includes remaining/max quantity', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const list = await myResources(base, 'nova.reyes');
    const food = list.find((r) => r.name === 'Food Supply Station')!;
    assert.equal(food.maxQty, 20);
    assert.equal(food.remainingQty, 18);
  });
});

test('discovery requires authentication (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    assert.equal((await fetch(`${base}/api/me/resources`)).status, 401);
  });
});

const loginUser = async (base: string, username: string) => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: DEMO_PASSWORD }),
  });
  const body = await res.json();
  return { token: body.token as string, id: body.user.id as string };
};

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

test('using a resource decrements remaining and records an audit log', async () => {
  const db = createDatabase(':memory:');
  migrate(db);
  const container = buildContainer(db);
  await seedDatabase(db, container.passwordHasher);
  const app = createApp(container);

  await withServer(app, async (base) => {
    const nova = await loginUser(base, 'nova.reyes');
    const list = (
      await (
        await fetch(`${base}/api/me/resources`, { headers: bearer(nova.token) })
      ).json()
    ).data as { id: string; name: string; remainingQty: number }[];
    const food = list.find((r) => r.name === 'Food Supply Station')!;
    assert.equal(food.remainingQty, 18);

    const res = await fetch(`${base}/api/me/resources/${food.id}/use`, {
      method: 'POST',
      headers: bearer(nova.token),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.remainingQty, 17);

    // Audit trail: who consumed what
    const logs = new SqliteUsageLogRepository(db).findByUser(nova.id);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].resourceId, food.id);
  });
});

test('using out-of-stock returns 409 and no-access returns 403', async () => {
  const db = createDatabase(':memory:');
  migrate(db);
  const container = buildContainer(db);
  await seedDatabase(db, container.passwordHasher);
  const app = createApp(container);

  await withServer(app, async (base) => {
    const ada = await loginUser(base, 'ada.lovelace'); // crew, can create resources
    const nova = await loginUser(base, 'nova.reyes'); // SILVER

    // A SILVER resource with capacity 1
    const created = await fetch(`${base}/api/resources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(ada.token) },
      body: JSON.stringify({ name: 'Last Ration', minLevel: 'SILVER', maxQty: 1 }),
    });
    const { data: ration } = await created.json();

    const first = await fetch(`${base}/api/me/resources/${ration.id}/use`, {
      method: 'POST',
      headers: bearer(nova.token),
    });
    assert.equal(first.status, 200);
    const second = await fetch(`${base}/api/me/resources/${ration.id}/use`, {
      method: 'POST',
      headers: bearer(nova.token),
    });
    assert.equal(second.status, 409); // out of stock

    // A GOLD resource nova cannot access
    const all = (
      await (await fetch(`${base}/api/resources`, { headers: bearer(ada.token) })).json()
    ).data as { id: string; name: string }[];
    const cabin = all.find((r) => r.name === 'Private Cabin')!; // GOLD
    const forbidden = await fetch(`${base}/api/me/resources/${cabin.id}/use`, {
      method: 'POST',
      headers: bearer(nova.token),
    });
    assert.equal(forbidden.status, 403);
  });
});

const loginStatus = async (base: string, username: string, password: string) =>
  (
    await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  ).status;

test('a user can edit their own profile but not their membership tier', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const nova = await loginUser(base, 'nova.reyes');

    const profile = (
      await (
        await fetch(`${base}/api/me/profile`, { headers: bearer(nova.token) })
      ).json()
    ).data;
    assert.equal(profile.username, 'nova.reyes');
    assert.equal(profile.membershipLevel, 'SILVER');

    // Update name/username/password and *try* to change tier — tier must be ignored.
    const updated = await fetch(`${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...bearer(nova.token) },
      body: JSON.stringify({
        name: 'Nova R',
        username: 'nova.r',
        password: 'newpass1',
        membershipLevel: 'PLATINUM',
        currentPassword: DEMO_PASSWORD,
      }),
    });
    assert.equal(updated.status, 200);
    const data = (await updated.json()).data;
    assert.equal(data.username, 'nova.r');
    assert.equal(data.name, 'Nova R');
    assert.equal(data.membershipLevel, 'SILVER'); // unchanged

    assert.equal(await loginStatus(base, 'nova.r', 'newpass1'), 200);
  });
});

test('profile update requires the correct current access code', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const nova = await loginUser(base, 'nova.reyes');

    // Missing current access code → 400
    const missing = await fetch(`${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...bearer(nova.token) },
      body: JSON.stringify({ name: 'Nope' }),
    });
    assert.equal(missing.status, 400);

    // Wrong current access code → 401
    const wrong = await fetch(`${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...bearer(nova.token) },
      body: JSON.stringify({ name: 'Nope', currentPassword: 'wrongpass' }),
    });
    assert.equal(wrong.status, 401);
  });
});

test('profile username conflict is rejected (409); profile requires auth (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const nova = await loginUser(base, 'nova.reyes');
    const conflict = await fetch(`${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...bearer(nova.token) },
      body: JSON.stringify({ username: 'milo.chen', currentPassword: DEMO_PASSWORD }), // taken
    });
    assert.equal(conflict.status, 409);

    assert.equal((await fetch(`${base}/api/me/profile`)).status, 401);
  });
});
