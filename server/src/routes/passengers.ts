import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { isMembershipLevel, type MembershipLevel } from '../domain/membership.js';
import { toPublicUser, type UserUpdate } from '../domain/models.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
import type { PasswordHasher } from '../domain/ports/passwordHasher.js';
import type { HttpError } from '../types.js';

const badRequest = (message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = 400;
  return err;
};

const conflict = (message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = 409;
  return err;
};

const notFound = (): HttpError => {
  const err: HttpError = new Error('Passenger not found');
  err.status = 404;
  return err;
};

interface NewPassengerInput {
  username: string;
  password: string;
  name: string;
  membershipLevel: MembershipLevel;
}

function validateNew(body: unknown): NewPassengerInput {
  const { name, membershipLevel, username, password } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('`name` is required');
  }
  if (!isMembershipLevel(membershipLevel)) {
    throw badRequest('`membershipLevel` must be SILVER, GOLD, or PLATINUM');
  }
  if (typeof username !== 'string' || !username.trim()) {
    throw badRequest('`username` is required');
  }
  if (typeof password !== 'string' || password.length < 4) {
    throw badRequest('`password` must be at least 4 characters');
  }
  return {
    name: name.trim(),
    membershipLevel,
    username: username.trim().toLowerCase(),
    password,
  };
}

interface PassengerUpdateInput {
  name?: string;
  membershipLevel?: MembershipLevel;
  username?: string;
  password?: string; // plain; hashed in the handler. Blank/absent = unchanged.
}

function validateUpdate(body: unknown): PassengerUpdateInput {
  const src = (body ?? {}) as Record<string, unknown>;
  const changes: PassengerUpdateInput = {};
  if (src.name !== undefined) {
    if (typeof src.name !== 'string' || !src.name.trim()) {
      throw badRequest('`name` must be a non-empty string');
    }
    changes.name = src.name.trim();
  }
  if (src.membershipLevel !== undefined) {
    if (!isMembershipLevel(src.membershipLevel)) {
      throw badRequest('`membershipLevel` must be SILVER, GOLD, or PLATINUM');
    }
    changes.membershipLevel = src.membershipLevel;
  }
  if (src.username !== undefined) {
    if (typeof src.username !== 'string' || !src.username.trim()) {
      throw badRequest('`username` must be a non-empty string');
    }
    changes.username = src.username.trim().toLowerCase();
  }
  // Only treat a non-empty password as a change request.
  if (src.password !== undefined && src.password !== '') {
    if (typeof src.password !== 'string' || src.password.length < 4) {
      throw badRequest('`password` must be at least 4 characters');
    }
    changes.password = src.password;
  }
  return changes;
}

export function createPassengersRouter(
  users: UserRepository,
  hasher: PasswordHasher,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  // Passenger management is strictly Crew Lead only.
  router.use(authenticate, requireRole('CREW_LEAD'));

  // Crew leads are excluded — this lists regular passengers only.
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: users.findPassengers().map(toPublicUser) });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = validateNew(req.body);
      if (users.findByUsername(input.username)) {
        throw conflict('That username is already taken');
      }
      const passwordHash = await hasher.hash(input.password);
      const user = users.create({
        username: input.username,
        passwordHash,
        name: input.name,
        membershipLevel: input.membershipLevel,
        isCrewLead: false,
      });
      res.status(201).json({ data: toPublicUser(user) });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const target = users.findById(req.params.id);
      if (!target) throw notFound();

      const input = validateUpdate(req.body);
      if (input.username && input.username !== target.username) {
        const clash = users.findByUsername(input.username);
        if (clash && clash.id !== target.id) {
          throw conflict('That username is already taken');
        }
      }

      const changes: UserUpdate = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.membershipLevel !== undefined
          ? { membershipLevel: input.membershipLevel }
          : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
      };
      if (input.password) {
        changes.passwordHash = await hasher.hash(input.password);
      }

      const updated = users.update(req.params.id, changes);
      res.json({ data: toPublicUser(updated ?? target) });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const target = users.findById(req.params.id);
      if (!target) throw notFound();
      if (target.isCrewLead) {
        throw badRequest('Cannot delete a crew lead here — use the Crew Leads page');
      }
      users.delete(req.params.id);
      res.status(204).end();
    }),
  );

  return router;
}
