import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';

import { createDatabase, migrate } from '../src/db/index.js';
import { buildContainer } from '../src/container.js';
import { createApp } from '../src/app.js';

const db = createDatabase(':memory:');
migrate(db);
const app = createApp(buildContainer(db));

// Starts the app on an ephemeral port, runs requests, then closes.
const withServer = async (fn: (base: string) => Promise<void>): Promise<void> => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

test('GET /api/health returns ok', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });
});

test('unknown route returns 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/does-not-exist`);
    assert.equal(res.status, 404);
  });
});
