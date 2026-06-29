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

    assert.ok(data.length >= 1 && data.length <= 3);
    // Most-used first, every entry has real usage and a named resource.
    for (let i = 1; i < data.length; i += 1) {
      assert.ok(data[i - 1].uses >= data[i].uses);
    }
    assert.ok(
      data.every(
        (d: { uses: number; resource: { name: string } }) =>
          d.uses > 0 && typeof d.resource.name === 'string',
      ),
    );
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
    // Every used resource is returned (no 10-cap), most-used first.
    assert.ok(data.length >= 1);
    for (let i = 1; i < data.length; i += 1) {
      assert.ok(data[i - 1].uses >= data[i].uses);
    }
    assert.ok(data.every((d: { uses: number }) => d.uses > 0));
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

    // Up to three most-depleted resources, lowest stock ratio first.
    assert.ok(data.length >= 1 && data.length <= 3);
    const ratio = (r: { remainingQty: number; maxQty: number }) =>
      r.remainingQty / r.maxQty;
    for (let i = 1; i < data.length; i += 1) {
      assert.ok(ratio(data[i - 1]) <= ratio(data[i]) + 1e-9);
    }
  });
});

test('audit trail returns usage and refill activity, newest first, with names', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');

    // Make an identifiable refill on top of the seeded activity: top the cabin
    // up, free two units, then refill exactly 2 — so the newest REFILL on the
    // cabin is unambiguously this one (Ada, amount 2).
    const { data: resources } = await (
      await fetch(`${base}/api/resources`, { headers: authJson(token) })
    ).json();
    const cabin = resources.find((r: { name: string }) => r.name === 'Private Cabin');
    const refillCabin = (amount: number) =>
      fetch(`${base}/api/resources/${cabin.id}/refill`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authJson(token) },
        body: JSON.stringify({ amount }),
      });
    const room = cabin.maxQty - cabin.remainingQty;
    if (room > 0) await refillCabin(room); // -> full
    await fetch(`${base}/api/resources/${cabin.id}/write-off`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authJson(token) },
      body: JSON.stringify({ amount: 2 }),
    });
    await refillCabin(2);

    // Filter to the cabin so the page covers its activity regardless of how busy
    // the rest of the trail is.
    const res = await fetch(
      `${base}/api/reports/audit?resourceId=${cabin.id}&pageSize=100`,
      { headers: authJson(token) },
    );
    assert.equal(res.status, 200);
    const { data, total } = await res.json();

    assert.ok(total > 0);
    assert.ok(data.length > 0 && data.length <= 100);
    assert.ok(data.every((e: { resourceId: string }) => e.resourceId === cabin.id));

    // The newest REFILL on the cabin is the one we just made, enriched.
    const madeRefill = data.find((e: { type: string }) => e.type === 'REFILL');
    assert.ok(madeRefill, 'refill activity is in the trail');
    assert.equal(madeRefill.userName, 'Ada Lovelace');
    assert.equal(madeRefill.amount, 2);

    // Both activity types are present and every entry is name-enriched.
    const types = new Set(data.map((e: { type: string }) => e.type));
    assert.ok(types.has('USE'));
    assert.ok(types.has('REFILL'));
    assert.ok(
      data.every(
        (e: { userName: string; resourceName: string; userLevel: string }) =>
          typeof e.userName === 'string' &&
          typeof e.resourceName === 'string' &&
          ['SILVER', 'GOLD', 'PLATINUM'].includes(e.userLevel),
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
    const total = firstPage.total;
    assert.ok(total > 5);

    // The total holds across pages, and a later page returns a full slice too.
    const secondPage = await get('?pageSize=5&page=2');
    assert.equal(secondPage.total, total);
    assert.equal(secondPage.data.length, 5);

    // Resource filter narrows to that resource, and every returned row matches.
    const { data: resources } = await (
      await fetch(`${base}/api/resources`, { headers: authJson(token) })
    ).json();
    const pod = resources.find((r: { name: string }) => r.name === 'Sleeping Pod');
    const byResource = await get(`?resourceId=${pod.id}&pageSize=100`);
    assert.ok(byResource.total > 0 && byResource.total <= total);
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

    // Counts and capacity are fixed by the seed; stock and uses are
    // simulation-driven — every tier consumes, so all show usage.
    const within = (r: { remaining: number; capacity: number }) =>
      r.remaining >= 0 && r.remaining <= r.capacity;

    assert.equal(byLevel.SILVER.passengers, 2);
    assert.equal(byLevel.SILVER.resources, 3);
    assert.equal(byLevel.SILVER.capacity, 179); // 99 + 50 + 30
    assert.ok(within(byLevel.SILVER));
    assert.ok(byLevel.SILVER.uses > 0);

    assert.equal(byLevel.GOLD.passengers, 2);
    assert.equal(byLevel.GOLD.resources, 2);
    assert.equal(byLevel.GOLD.capacity, 15); // 10 + 5
    assert.ok(within(byLevel.GOLD));
    assert.ok(byLevel.GOLD.uses > 0);

    assert.equal(byLevel.PLATINUM.passengers, 2);
    assert.equal(byLevel.PLATINUM.resources, 2);
    assert.equal(byLevel.PLATINUM.capacity, 12); // 8 + 4
    assert.ok(within(byLevel.PLATINUM));
    assert.ok(byLevel.PLATINUM.uses > 0);
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
