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

const login = async (base: string, username: string) => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: DEMO_PASSWORD }),
  });
  const body = await res.json();
  return { token: body.token as string, id: body.user.id as string };
};

const authJson = (token: string) => ({
  'content-type': 'application/json',
  authorization: `Bearer ${token}`,
});

const idByUsername = async (
  base: string,
  token: string,
  path: string,
  username: string,
) => {
  const res = await fetch(`${base}${path}`, { headers: authJson(token) });
  const { data } = await res.json();
  return (data as { id: string; username: string }[]).find(
    (u) => u.username === username,
  )!.id;
};

test('propose + approve swaps a crew lead with a passenger, count stays 3', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const ada = await login(base, 'ada.lovelace'); // proposer
    const katherine = await login(base, 'katherine.johnson'); // approver

    const graceId = await idByUsername(
      base,
      ada.token,
      '/api/crew-leads',
      'grace.hopper',
    );
    const novaId = await idByUsername(base, ada.token, '/api/passengers', 'nova.reyes');

    // Propose: demote grace, promote nova
    const proposed = await fetch(`${base}/api/crew-leads/requests`, {
      method: 'POST',
      headers: authJson(ada.token),
      body: JSON.stringify({ demoteId: graceId, promoteId: novaId }),
    });
    assert.equal(proposed.status, 201);
    const { data: request } = await proposed.json();
    assert.equal(request.status, 'PENDING');

    // A different crew lead approves
    const approved = await fetch(
      `${base}/api/crew-leads/requests/${request.id}/approve`,
      { method: 'POST', headers: authJson(katherine.token) },
    );
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).data.status, 'APPROVED');

    // Still exactly 3 crew leads; grace out, nova in
    const crew = await fetch(`${base}/api/crew-leads`, { headers: authJson(ada.token) });
    const { data: crewLeads } = await crew.json();
    assert.equal(crewLeads.length, 3);
    const names = crewLeads.map((c: { username: string }) => c.username);
    assert.ok(names.includes('nova.reyes'));
    assert.ok(!names.includes('grace.hopper'));
  });
});

test('the proposer cannot approve their own request (403)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const ada = await login(base, 'ada.lovelace');
    const graceId = await idByUsername(
      base,
      ada.token,
      '/api/crew-leads',
      'grace.hopper',
    );
    const novaId = await idByUsername(base, ada.token, '/api/passengers', 'nova.reyes');

    const proposed = await fetch(`${base}/api/crew-leads/requests`, {
      method: 'POST',
      headers: authJson(ada.token),
      body: JSON.stringify({ demoteId: graceId, promoteId: novaId }),
    });
    const { data: request } = await proposed.json();

    const selfApprove = await fetch(
      `${base}/api/crew-leads/requests/${request.id}/approve`,
      { method: 'POST', headers: authJson(ada.token) },
    );
    assert.equal(selfApprove.status, 403);
  });
});

test('a passenger cannot propose a swap (403)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const nova = await login(base, 'nova.reyes');
    const res = await fetch(`${base}/api/crew-leads/requests`, {
      method: 'POST',
      headers: authJson(nova.token),
      body: JSON.stringify({ demoteId: 'x', promoteId: 'y' }),
    });
    assert.equal(res.status, 403);
  });
});

test('a demoted crew lead loses crew powers immediately (live authorization)', async () => {
  const app = await buildSeededApp();
  await withServer(app, async (base) => {
    const ada = await login(base, 'ada.lovelace');
    const katherine = await login(base, 'katherine.johnson');
    const grace = await login(base, 'grace.hopper'); // token issued while still a crew lead

    const graceId = await idByUsername(
      base,
      ada.token,
      '/api/crew-leads',
      'grace.hopper',
    );
    const novaId = await idByUsername(base, ada.token, '/api/passengers', 'nova.reyes');

    // grace's token grants crew access right now
    const before = await fetch(`${base}/api/crew-leads/requests`, {
      headers: authJson(grace.token),
    });
    assert.equal(before.status, 200);

    // propose demoting grace + approve with a different crew lead
    const proposed = await fetch(`${base}/api/crew-leads/requests`, {
      method: 'POST',
      headers: authJson(ada.token),
      body: JSON.stringify({ demoteId: graceId, promoteId: novaId }),
    });
    const { data: request } = await proposed.json();
    await fetch(`${base}/api/crew-leads/requests/${request.id}/approve`, {
      method: 'POST',
      headers: authJson(katherine.token),
    });

    // grace's still-valid token no longer grants crew powers (role re-read from DB)
    const after = await fetch(`${base}/api/crew-leads/requests`, {
      headers: authJson(grace.token),
    });
    assert.equal(after.status, 403);
  });
});
