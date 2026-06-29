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

interface TierUsage {
  level: string;
  uses: number;
}
interface DailyUsage {
  day: string;
  count: number;
}

test('per-resource usage returns a daily series and a by-tier breakdown', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const token = await tokenFor(base, 'ada.lovelace');

    // The most-used seeded resource (Sleeping Pod, 14 uses) gives a known total.
    const hd = await (
      await fetch(`${base}/api/reports/high-demand`, { headers: authJson(token) })
    ).json();
    const pod = hd.data[0].resource;

    const res = await fetch(`${base}/api/reports/resources/${pod.id}/usage`, {
      headers: authJson(token),
    });
    assert.equal(res.status, 200);
    const { data } = await res.json();

    assert.equal(data.resource.id, pod.id);
    assert.deepEqual(
      data.byTier.map((t: TierUsage) => t.level),
      ['SILVER', 'GOLD', 'PLATINUM'],
    );
    const tierTotal = data.byTier.reduce((s: number, t: TierUsage) => s + t.uses, 0);
    const dailyTotal = data.daily.reduce((s: number, d: DailyUsage) => s + d.count, 0);
    // by-tier covers all time; the daily window is a (non-empty) subset of it.
    assert.ok(tierTotal > 0);
    assert.ok(dailyTotal > 0);
    assert.ok(dailyTotal <= tierTotal);
  });
});

test('per-resource usage is crew-lead only (403) and 404s an unknown resource', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const crew = await tokenFor(base, 'ada.lovelace');
    const passenger = await tokenFor(base, 'nova.reyes');

    const forbidden = await fetch(`${base}/api/reports/resources/any/usage`, {
      headers: authJson(passenger),
    });
    assert.equal(forbidden.status, 403);

    const missing = await fetch(`${base}/api/reports/resources/nope/usage`, {
      headers: authJson(crew),
    });
    assert.equal(missing.status, 404);
  });
});
