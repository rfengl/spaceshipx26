import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';

import app from '../src/app.js';

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

test('missions CRUD lifecycle', async () => {
  await withServer(async (base) => {
    // Create
    const created = await fetch(`${base}/api/missions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test Flight', crew: 2 }),
    });
    assert.equal(created.status, 201);
    const { data: mission } = await created.json();
    assert.ok(mission.id);

    // Read
    const fetched = await fetch(`${base}/api/missions/${mission.id}`);
    assert.equal(fetched.status, 200);

    // Delete
    const deleted = await fetch(`${base}/api/missions/${mission.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);

    // Confirm gone
    const missing = await fetch(`${base}/api/missions/${mission.id}`);
    assert.equal(missing.status, 404);
  });
});

test('POST /api/missions validates name', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/missions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ crew: 1 }),
    });
    assert.equal(res.status, 400);
  });
});
