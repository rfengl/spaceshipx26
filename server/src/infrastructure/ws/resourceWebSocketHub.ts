import type { IncomingMessage, Server } from 'node:http';

import { WebSocket, WebSocketServer } from 'ws';

import { hasAccess, type MembershipLevel } from '../../domain/membership.js';
import type {
  ResourceChange,
  ResourcePublisher,
} from '../../domain/ports/resourcePublisher.js';
import type { TokenService } from '../../domain/ports/tokenService.js';
import type { UserRepository } from '../../domain/ports/userRepository.js';

// What a connection is allowed to see. Crew see everything; a passenger only
// sees resources their membership tier can access (so nothing above their tier
// — and no more than /api/me/resources already returns — is ever pushed).
interface ClientMeta {
  isCrew: boolean;
  tier: MembershipLevel;
}

/**
 * Broadcasts resource-change events to connected clients over WebSockets.
 * Connections authenticate with the JWT (passed as `?token=`) during the
 * handshake; updates are then filtered per-connection by membership tier.
 *
 * Until `attach` is called (e.g. in tests) `publish` is a no-op.
 */
export class ResourceWebSocketHub implements ResourcePublisher {
  private wss: WebSocketServer | null = null;
  private readonly clients = new Map<WebSocket, ClientMeta>();
  // Carries the authenticated identity from the handshake to the connection.
  private readonly pending = new WeakMap<IncomingMessage, ClientMeta>();

  constructor(
    private readonly tokens: TokenService,
    private readonly users: UserRepository,
    private readonly path = '/ws/resources',
  ) {}

  attach(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: this.path,
      // Authenticate during the handshake so unauthenticated clients are
      // rejected with 401 and never establish a connection.
      verifyClient: (info, done) => {
        const meta = this.authenticate(info.req);
        if (meta) this.pending.set(info.req, meta);
        done(Boolean(meta));
      },
    });

    this.wss.on('connection', (ws, req) => {
      const meta = this.pending.get(req);
      this.pending.delete(req);
      if (!meta) {
        ws.close(4401, 'Unauthorized');
        return;
      }
      this.clients.set(ws, meta);
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });
  }

  // Verify the token live: a deleted/deactivated account is rejected at connect.
  private authenticate(req: IncomingMessage): ClientMeta | null {
    try {
      const token = new URL(req.url ?? '', 'http://localhost').searchParams.get('token');
      if (!token) return null;
      const claims = this.tokens.verify(token);
      const user = this.users.findById(claims.id);
      if (!user || !user.active) return null;
      return { isCrew: user.isCrewLead, tier: user.membershipLevel };
    } catch {
      return null;
    }
  }

  private canSee(meta: ClientMeta, minLevel: MembershipLevel): boolean {
    return meta.isCrew || hasAccess(meta.tier, minLevel);
  }

  publish(change: ResourceChange): void {
    if (!this.wss) return;
    const payload = JSON.stringify(change);
    for (const [ws, meta] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      // Removal is just an id (no detail), so it can go to everyone; updates
      // carry resource detail and are gated by tier.
      if (
        change.type === 'resource.updated' &&
        !this.canSee(meta, change.resource.minLevel)
      ) {
        continue;
      }
      ws.send(payload);
    }
  }

  close(): void {
    for (const ws of this.clients.keys()) ws.close();
    this.clients.clear();
    this.wss?.close();
    this.wss = null;
  }
}
