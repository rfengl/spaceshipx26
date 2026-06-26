import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';

import { createDatabase, migrate } from '../src/db/index.js';
import { seedDatabase, DEMO_PASSWORD } from '../src/db/seed.js';
import { buildContainer } from '../src/container.js';
import { createApp } from '../src/app.js';

import type { Express } from 'express';

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

// Real container (bcrypt + jwt) over an in-memory DB seeded with demo accounts.
const buildSeededApp = async () => {
  const db = createDatabase(':memory:');
  migrate(db);
  const container = buildContainer(db);
  await seedDatabase(db, container.passwordHasher);
  return createApp(container);
};

test('POST /api/auth/login issues a JWT for valid credentials', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada.lovelace', password: DEMO_PASSWORD }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.token, 'returns a token');
    assert.equal(body.user.role, 'CREW_LEAD');
    assert.equal(body.user.passwordHash, undefined);
  });
});

test('POST /api/auth/login rejects bad credentials with 401', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada.lovelace', password: 'nope' }),
    });
    assert.equal(res.status, 401);
  });
});

test('GET /api/auth/me returns the user with a valid token, 401 without', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'nova.reyes', password: DEMO_PASSWORD }),
    });
    const { token } = await login.json();

    const me = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(me.status, 200);
    const body = await me.json();
    assert.equal(body.user.username, 'nova.reyes');
    assert.equal(body.user.role, 'PASSENGER');

    const noToken = await fetch(`${base}/api/auth/me`);
    assert.equal(noToken.status, 401);
  });
});
