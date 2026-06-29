import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { WebSocket } from 'ws';

import { createDatabase, migrate } from '../src/db/index.js';
import { SqliteUserRepository } from '../src/infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../src/infrastructure/sqlite/sqliteResourceRepository.js';
import { JwtTokenService } from '../src/infrastructure/security/jwtTokenService.js';
import { ResourceWebSocketHub } from '../src/infrastructure/ws/resourceWebSocketHub.js';
import type { Role } from '../src/domain/models.js';

const tokens = new JwtTokenService('test-secret', '1h');
const tokenFor = (id: string, username: string, role: Role) =>
  tokens.sign({ id, username, role });

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A fresh in-memory DB with the repositories and hub wired to one token service.
function build() {
  const db = createDatabase(':memory:');
  migrate(db);
  const users = new SqliteUserRepository(db);
  const resources = new SqliteResourceRepository(db);
  const hub = new ResourceWebSocketHub(tokens, users);
  return { users, resources, hub };
}

// Attach the hub to an ephemeral HTTP server and return the port + a teardown.
async function listen(hub: ResourceWebSocketHub) {
  const server = createServer();
  hub.attach(server);
  server.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    close: async () => {
      hub.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// Resolves once the socket is open; rejects if the handshake is refused (401).
function connect(port: number, token: string | null): Promise<WebSocket> {
  const query = token === null ? '' : `?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/resources${query}`);
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('unexpected-response', () => reject(new Error('handshake refused')));
    ws.once('error', reject);
  });
}

// The next pushed message (parsed), or null if none arrives within `ms`.
function nextMessage(ws: WebSocket, ms = 200): Promise<unknown | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

test('accepts a valid token and refuses a missing or invalid one at the handshake', async () => {
  const { users, hub } = build();
  const crew = users.create({
    username: 'ada',
    passwordHash: 'h',
    name: 'Ada',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
  });
  const { port, close } = await listen(hub);
  try {
    const ws = await connect(port, tokenFor(crew.id, crew.username, 'CREW_LEAD'));
    assert.equal(ws.readyState, WebSocket.OPEN);
    ws.close();

    await assert.rejects(connect(port, null), 'no token is refused');
    await assert.rejects(connect(port, 'not-a-real-token'), 'a bad token is refused');
  } finally {
    await close();
  }
});

test('refuses a token whose account has been deactivated', async () => {
  const { users, hub } = build();
  const user = users.create({
    username: 'nova',
    passwordHash: 'h',
    name: 'Nova',
    membershipLevel: 'SILVER',
    isCrewLead: false,
  });
  // Token is valid, but the account is gone by connect time.
  const token = tokenFor(user.id, user.username, 'PASSENGER');
  users.deactivate(user.id);

  const { port, close } = await listen(hub);
  try {
    await assert.rejects(connect(port, token));
  } finally {
    await close();
  }
});

test('publish pushes an update only to clients whose tier can access the resource', async () => {
  const { users, resources, hub } = build();
  const crew = users.create({
    username: 'ada',
    passwordHash: 'h',
    name: 'Ada',
    membershipLevel: 'PLATINUM',
    isCrewLead: true,
  });
  const silver = users.create({
    username: 'sam',
    passwordHash: 'h',
    name: 'Sam',
    membershipLevel: 'SILVER',
    isCrewLead: false,
  });
  const platinum = users.create({
    username: 'pia',
    passwordHash: 'h',
    name: 'Pia',
    membershipLevel: 'PLATINUM',
    isCrewLead: false,
  });
  const luxuryPod = resources.create({
    name: 'Luxury Oxygen Pod',
    minLevel: 'PLATINUM',
    maxQty: 5,
  });

  const { port, close } = await listen(hub);
  try {
    const crewWs = await connect(port, tokenFor(crew.id, crew.username, 'CREW_LEAD'));
    const silverWs = await connect(
      port,
      tokenFor(silver.id, silver.username, 'PASSENGER'),
    );
    const platinumWs = await connect(
      port,
      tokenFor(platinum.id, platinum.username, 'PASSENGER'),
    );
    // Let the server finish registering all three connections.
    await delay(50);

    const crewMsg = nextMessage(crewWs);
    const silverMsg = nextMessage(silverWs);
    const platinumMsg = nextMessage(platinumWs);

    hub.publish({ type: 'resource.updated', resource: luxuryPod });

    const expected = { type: 'resource.updated', resource: luxuryPod };
    // Crew see everything; a platinum passenger can reach a platinum resource.
    assert.deepEqual(await crewMsg, expected);
    assert.deepEqual(await platinumMsg, expected);
    // A silver passenger must never receive a resource above their tier.
    assert.equal(await silverMsg, null);

    crewWs.close();
    silverWs.close();
    platinumWs.close();
  } finally {
    await close();
  }
});
