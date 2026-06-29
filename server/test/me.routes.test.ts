import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

import { createDatabase, migrate } from '../src/db/index.js';
import { seedDatabase, DEMO_PASSWORD } from '../src/db/seed.js';
import { buildContainer } from '../src/container.js';
import { createApp } from '../src/app.js';
import { SqliteAuditTrailRepository } from '../src/infrastructure/sqlite/sqliteAuditTrailRepository.js';

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
    assert.equal(food.maxQty, 99);
    // Remaining is simulation-driven; it just has to stay within capacity.
    assert.ok(food.remainingQty >= 0 && food.remainingQty <= food.maxQty);
  });
});

test('decommissioned resources stay visible (flagged inactive) but cannot be used', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const ada = await loginUser(base, 'ada.lovelace'); // crew
    const nova = await loginUser(base, 'nova.reyes'); // SILVER

    const all = (
      await (await fetch(`${base}/api/resources`, { headers: bearer(ada.token) })).json()
    ).data as { id: string; name: string }[];
    const food = all.find((r) => r.name === 'Food Supply Station')!; // SILVER

    // Crew decommissions it.
    await fetch(`${base}/api/resources/${food.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...bearer(ada.token) },
      body: JSON.stringify({ isDecommissioned: true }),
    });

    // Passenger still sees it in discovery, marked decommissioned.
    const list = (
      await (
        await fetch(`${base}/api/me/resources`, { headers: bearer(nova.token) })
      ).json()
    ).data as { id: string; name: string; isDecommissioned: boolean }[];
    const shown = list.find((r) => r.id === food.id);
    assert.ok(shown, 'decommissioned resource is still listed');
    assert.equal(shown!.isDecommissioned, true);

    // But using it is rejected.
    const used = await fetch(`${base}/api/me/resources/${food.id}/use`, {
      method: 'POST',
      headers: bearer(nova.token),
    });
    assert.equal(used.status, 409);
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
    const beforeStock = food.remainingQty;
    assert.ok(beforeStock >= 1, 'resource has stock to use');

    const audit = new SqliteAuditTrailRepository(db);
    const beforeLogs = audit.search({ userId: nova.id }, 1, 0).total;

    const res = await fetch(`${base}/api/me/resources/${food.id}/use`, {
      method: 'POST',
      headers: bearer(nova.token),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.remainingQty, beforeStock - 1);

    // Audit trail: the use adds exactly one entry for this passenger.
    const { entries: logs, total } = audit.search({ userId: nova.id }, 100, 0);
    assert.equal(total, beforeLogs + 1);
    assert.ok(logs.some((l) => l.type === 'USE' && l.resourceId === food.id));

    // Personal history returns this passenger's own entries, enriched.
    const history = (
      await (
        await fetch(`${base}/api/me/history`, { headers: bearer(nova.token) })
      ).json()
    ).data as { type: string; resourceName: string; userName: string }[];
    assert.ok(history.length >= 1);
    assert.ok(history.every((h) => h.userName === 'Nova Reyes'));
    assert.ok(
      history.some((h) => h.type === 'USE' && h.resourceName === 'Food Supply Station'),
    );
  });
});

test('personal history is scoped to the requesting user only', async () => {
  const db = createDatabase(':memory:');
  migrate(db);
  const container = buildContainer(db);
  await seedDatabase(db, container.passwordHasher);
  const app = createApp(container);

  await withServer(app, async (base) => {
    const nova = await loginUser(base, 'nova.reyes'); // SILVER
    const list = (
      await (
        await fetch(`${base}/api/me/resources`, { headers: bearer(nova.token) })
      ).json()
    ).data as { id: string; name: string }[];
    const food = list.find((r) => r.name === 'Food Supply Station')!;
    await fetch(`${base}/api/me/resources/${food.id}/use`, {
      method: 'POST',
      headers: bearer(nova.token),
    });

    // Nova's history contains only her own activity.
    const novaHistory = (
      await (
        await fetch(`${base}/api/me/history`, { headers: bearer(nova.token) })
      ).json()
    ).data as { userName: string }[];
    assert.ok(novaHistory.length >= 1);
    assert.ok(novaHistory.every((h) => h.userName === 'Nova Reyes'));

    // A brand-new passenger has an empty history even though the trail isn't.
    const ada = await loginUser(base, 'ada.lovelace');
    await fetch(`${base}/api/passengers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...bearer(ada.token) },
      body: JSON.stringify({
        username: 'fresh.cadet',
        password: DEMO_PASSWORD,
        name: 'Fresh Cadet',
        membershipLevel: 'SILVER',
      }),
    });
    const fresh = await loginUser(base, 'fresh.cadet');
    const freshHistory = (
      await (
        await fetch(`${base}/api/me/history`, { headers: bearer(fresh.token) })
      ).json()
    ).data as unknown[];
    assert.equal(freshHistory.length, 0);

    // History requires authentication.
    assert.equal((await fetch(`${base}/api/me/history`)).status, 401);
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
