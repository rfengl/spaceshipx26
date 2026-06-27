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
