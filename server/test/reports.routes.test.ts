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

const authJson = (token: string) => ({ authorization: `Bearer ${token}` });

test('high-demand returns the top resources by usage (crew lead)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const res = await fetch(`${base}/api/reports/high-demand`, {
      headers: authJson(token),
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();

    assert.equal(data.length, 3);
    assert.equal(data[0].resource.name, 'Sleeping Pod');
    assert.equal(data[0].uses, 14);
    assert.equal(data[1].resource.name, 'Food Supply Station');
    assert.equal(data[2].resource.name, 'Luxury Oxygen Pod');
  });
});

test('high-demand accepts a larger limit (for sorting the whole inventory)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const res = await fetch(`${base}/api/reports/high-demand?limit=1000`, {
      headers: authJson(token),
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();
    // Seed attributes usage to 5 distinct resources, all returned (no 10-cap).
    assert.equal(data.length, 5);
    assert.equal(data[0].resource.name, 'Sleeping Pod');
  });
});

test('high-demand is crew-lead only (403) and requires auth (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const passenger = await tokenFor(base, 'nova.reyes');
    assert.equal(
      (await fetch(`${base}/api/reports/high-demand`, { headers: authJson(passenger) }))
        .status,
      403,
    );
    assert.equal((await fetch(`${base}/api/reports/high-demand`)).status, 401);
  });
});

test('shortages returns the most depleted resources first (lowest stock ratio)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const res = await fetch(`${base}/api/reports/shortages`, {
      headers: authJson(token),
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();

    // Seeded ratios: Basic Hygiene Pod 8/30, Private Cabin 3/10, Luxury O2 3/8.
    assert.equal(data.length, 3);
    assert.equal(data[0].name, 'Basic Hygiene Pod');
    assert.equal(data[1].name, 'Private Cabin');
    assert.equal(data[2].name, 'Luxury Oxygen Pod');
  });
});

test('audit trail returns usage and refill activity, newest first, with names', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');

    // Refill a resource to create a REFILL entry on top of the seeded usage.
    const { data: resources } = await (
      await fetch(`${base}/api/resources`, { headers: authJson(token) })
    ).json();
    const cabin = resources.find((r: { name: string }) => r.name === 'Private Cabin');
    await fetch(`${base}/api/resources/${cabin.id}/refill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authJson(token) },
      body: JSON.stringify({ amount: 2 }),
    });

    const res = await fetch(`${base}/api/reports/audit?pageSize=100`, {
      headers: authJson(token),
    });
    assert.equal(res.status, 200);
    const { data, total } = await res.json();

    assert.ok(data.length > 0);
    // The server reports the full match count alongside the page (35 seeded
    // uses + the refill just made).
    assert.equal(total, 36);
    assert.equal(data.length, 36);

    // The refill we just made is present and enriched with names + amount.
    const refill = data.find(
      (e: { type: string; resourceName: string }) =>
        e.type === 'REFILL' && e.resourceName === 'Private Cabin',
    );
    assert.ok(refill, 'refill activity is in the trail');
    assert.equal(refill.userName, 'Ada Lovelace');
    assert.equal(refill.amount, 2);

    // Both activity types are present and every entry is name-enriched.
    const types = new Set(data.map((e: { type: string }) => e.type));
    assert.ok(types.has('USE'));
    assert.ok(types.has('REFILL'));
    assert.ok(
      data.every(
        (e: { userName: string; resourceName: string }) =>
          typeof e.userName === 'string' && typeof e.resourceName === 'string',
      ),
    );

    // Sorted newest-first (non-increasing timestamps).
    for (let i = 1; i < data.length; i += 1) {
      assert.ok(data[i - 1].at >= data[i].at);
    }
  });
});

test('audit trail records resource lifecycle actions (provision/decommission/delete)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const json = { 'content-type': 'application/json', ...authJson(token) };

    // Provision
    const created = await (
      await fetch(`${base}/api/resources`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ name: 'Observation Deck', minLevel: 'GOLD', maxQty: 4 }),
      })
    ).json();
    const id = created.data.id;

    // Decommission, then recommission
    await fetch(`${base}/api/resources/${id}`, {
      method: 'PUT',
      headers: json,
      body: JSON.stringify({ isDecommissioned: true }),
    });
    await fetch(`${base}/api/resources/${id}`, {
      method: 'PUT',
      headers: json,
      body: JSON.stringify({ isDecommissioned: false }),
    });
    // A plain edit (no decommission flip) must NOT add a lifecycle event.
    await fetch(`${base}/api/resources/${id}`, {
      method: 'PUT',
      headers: json,
      body: JSON.stringify({ name: 'Observation Lounge' }),
    });
    // Soft delete
    await fetch(`${base}/api/resources/${id}`, { method: 'DELETE', headers: json });

    // Filter server-side by the new resource so only its lifecycle rows return.
    const { data, total } = await (
      await fetch(`${base}/api/reports/audit?resourceId=${id}`, {
        headers: authJson(token),
      })
    ).json();
    assert.equal(total, 4);
    const actions = data.map((e: { type: string }) => e.type);

    assert.deepEqual([...actions].sort(), [
      'DECOMMISSION',
      'DELETE',
      'PROVISION',
      'RECOMMISSION',
    ]);
    const provision = data.find(
      (e: { resourceId: string; type: string }) =>
        e.resourceId === id && e.type === 'PROVISION',
    );
    assert.equal(provision.userName, 'Ada Lovelace');
    assert.equal(provision.resourceName, 'Observation Lounge');
  });
});

test('audit trail paginates and filters by resource and date server-side', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const get = async (qs: string) =>
      (
        await fetch(`${base}/api/reports/audit${qs}`, { headers: authJson(token) })
      ).json();

    // One page is a bounded slice, but total reflects every matching row.
    const firstPage = await get('?pageSize=5&page=1');
    assert.equal(firstPage.data.length, 5);
    assert.equal(firstPage.total, 35); // 35 seeded uses, no refills yet

    // The page count holds across pages, and a later page returns the remainder.
    const lastPage = await get('?pageSize=10&page=4');
    assert.equal(lastPage.total, 35);
    assert.equal(lastPage.data.length, 5); // rows 31–35

    // Resource filter narrows the total to that resource's use count (Sleeping
    // Pod is seeded with 14 uses), and every returned row matches.
    const { data: resources } = await (
      await fetch(`${base}/api/resources`, { headers: authJson(token) })
    ).json();
    const pod = resources.find((r: { name: string }) => r.name === 'Sleeping Pod');
    const byResource = await get(`?resourceId=${pod.id}&pageSize=100`);
    assert.equal(byResource.total, 14);
    assert.ok(
      byResource.data.every((e: { resourceId: string }) => e.resourceId === pod.id),
    );

    // A future date range matches nothing.
    const future = await get('?from=2999-01-01');
    assert.equal(future.total, 0);
    assert.equal(future.data.length, 0);
  });
});

test('aggregate report groups passengers, resources, stock, and uses by tier', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');
    const res = await fetch(`${base}/api/reports/aggregate`, {
      headers: authJson(token),
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();
    const byLevel = Object.fromEntries(data.map((r: { level: string }) => [r.level, r]));

    // Seed: 2 passengers per tier; resources grouped by required min tier;
    // all 35 seeded uses are attributed to a PLATINUM passenger.
    assert.deepEqual(byLevel.SILVER, {
      level: 'SILVER',
      passengers: 2,
      resources: 3,
      capacity: 100, // 20 + 50 + 30
      remaining: 46, // 18 + 20 + 8
      uses: 0,
    });
    assert.deepEqual(byLevel.GOLD, {
      level: 'GOLD',
      passengers: 2,
      resources: 2,
      capacity: 15, // 10 + 5
      remaining: 7, // 3 + 4
      uses: 0,
    });
    assert.deepEqual(byLevel.PLATINUM, {
      level: 'PLATINUM',
      passengers: 2,
      resources: 2,
      capacity: 12, // 8 + 4
      remaining: 7, // 3 + 4
      uses: 35,
    });
  });
});

test('aggregate report is crew-lead only (403) and requires auth (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const passenger = await tokenFor(base, 'nova.reyes');
    assert.equal(
      (await fetch(`${base}/api/reports/aggregate`, { headers: authJson(passenger) }))
        .status,
      403,
    );
    assert.equal((await fetch(`${base}/api/reports/aggregate`)).status, 401);
  });
});

test('shortages is crew-lead only (403) and requires auth (401)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const passenger = await tokenFor(base, 'nova.reyes');
    assert.equal(
      (await fetch(`${base}/api/reports/shortages`, { headers: authJson(passenger) }))
        .status,
      403,
    );
    assert.equal((await fetch(`${base}/api/reports/shortages`)).status, 401);
  });
});
