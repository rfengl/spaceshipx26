import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { toPublicUser, type UserUpdate } from '../domain/models.js';
import type { UsageService } from '../application/usageService.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
import type { PasswordHasher } from '../domain/ports/passwordHasher.js';
import type { ResourcePublisher } from '../domain/ports/resourcePublisher.js';
import type { AuditTrailRepository } from '../domain/ports/auditTrailRepository.js';
import { badRequest, conflict, unauthorized } from '../utils/httpError.js';
import { currentUser } from '../middleware/auth.js';

interface ProfileInput {
  name?: string;
  username?: string;
  password?: string; // plain; blank/absent leaves it unchanged
}

// Self-service profile edits: name, username, access code. NOT membership tier
// (a user can't change their own level) and not crew-lead status.
function validateProfile(body: unknown): ProfileInput {
  const src = (body ?? {}) as Record<string, unknown>;
  const out: ProfileInput = {};
  if (src.name !== undefined) {
    if (typeof src.name !== 'string' || !src.name.trim()) {
      throw badRequest('`name` must be a non-empty string');
    }
    out.name = src.name.trim();
  }
  if (src.username !== undefined) {
    if (typeof src.username !== 'string' || !src.username.trim()) {
      throw badRequest('`username` must be a non-empty string');
    }
    out.username = src.username.trim().toLowerCase();
  }
  if (src.password !== undefined && src.password !== '') {
    if (typeof src.password !== 'string' || src.password.length < 4) {
      throw badRequest('`password` must be at least 4 characters');
    }
    out.password = src.password;
  }
  return out;
}

/**
 * "Me" routes — resource discovery/use and the current user's own profile.
 */
export function createMeRouter(
  usage: UsageService,
  users: UserRepository,
  hasher: PasswordHasher,
  publisher: ResourcePublisher,
  audit: AuditTrailRepository,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  // --- Profile (self-service) ---

  router.get(
    '/profile',
    asyncHandler(async (req, res) => {
      const me = users.findById(currentUser(req).id);
      if (!me) throw unauthorized('Account no longer exists');
      res.json({ data: toPublicUser(me) });
    }),
  );

  router.put(
    '/profile',
    asyncHandler(async (req, res) => {
      const me = users.findById(currentUser(req).id);
      if (!me) throw unauthorized('Account no longer exists');

      // Re-authenticate: the current access code must be confirmed before any change.
      const currentPassword = (req.body ?? {}).currentPassword;
      if (typeof currentPassword !== 'string' || currentPassword === '') {
        throw badRequest('Your current access code is required');
      }
      if (!(await hasher.compare(currentPassword, me.passwordHash))) {
        throw unauthorized('Incorrect access code');
      }

      const input = validateProfile(req.body);
      if (input.username && input.username !== me.username) {
        const clash = users.findByUsername(input.username);
        if (clash && clash.id !== me.id) {
          throw conflict('That username is already taken');
        }
      }

      const changes: UserUpdate = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
      };
      if (input.password) {
        changes.passwordHash = await hasher.hash(input.password);
      }

      const updated = users.update(me.id, changes);
      res.json({ data: toPublicUser(updated ?? me) });
    }),
  );

  // --- Resource discovery & use ---

  router.get(
    '/resources',
    asyncHandler(async (req, res) => {
      res.json({ data: usage.listAvailable(currentUser(req).id) });
    }),
  );

  router.post(
    '/resources/:id/use',
    asyncHandler(async (req, res) => {
      const { resource } = usage.use(currentUser(req).id, req.params.id);
      // Crew dashboards see the stock drop live.
      publisher.publish({ type: 'resource.updated', resource });
      res.json({ data: resource });
    }),
  );

  // The current user's own activity history (newest first), paginated server-side
  // — it grows unbounded, so it's never loaded in full.
  router.get(
    '/history',
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
      const qs = (v: unknown) =>
        typeof v === 'string' && v.trim() ? v.trim() : undefined;
      const { entries, total } = audit.search(
        {
          userId: currentUser(req).id,
          resourceId: qs(req.query.resourceId),
          from: qs(req.query.from),
          to: qs(req.query.to),
        },
        pageSize,
        (page - 1) * pageSize,
      );
      res.json({ data: entries, total });
    }),
  );

  return router;
}
