import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { isMembershipLevel } from '../domain/membership.js';
import type { NewPassenger } from '../domain/models.js';
import type {
  PassengerRepository,
  PassengerUpdate,
} from '../domain/ports/passengerRepository.js';
import type { HttpError } from '../types.js';

const badRequest = (message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = 400;
  return err;
};

const notFound = (): HttpError => {
  const err: HttpError = new Error('Passenger not found');
  err.status = 404;
  return err;
};

function validateNew(body: unknown): NewPassenger {
  const { name, membershipLevel } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('`name` is required');
  }
  if (!isMembershipLevel(membershipLevel)) {
    throw badRequest('`membershipLevel` must be SILVER, GOLD, or PLATINUM');
  }
  return { name: name.trim(), membershipLevel };
}

function validateUpdate(body: unknown): PassengerUpdate {
  const src = (body ?? {}) as Record<string, unknown>;
  const changes: PassengerUpdate = {};
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
  return changes;
}

export function createPassengersRouter(
  passengers: PassengerRepository,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const crewOnly = requireRole('CREW_LEAD');

  router.use(authenticate);

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: passengers.findAll() });
    }),
  );

  router.post(
    '/',
    crewOnly,
    asyncHandler(async (req, res) => {
      res.status(201).json({ data: passengers.create(validateNew(req.body)) });
    }),
  );

  router.put(
    '/:id',
    crewOnly,
    asyncHandler(async (req, res) => {
      const updated = passengers.update(req.params.id, validateUpdate(req.body));
      if (!updated) throw notFound();
      res.json({ data: updated });
    }),
  );

  router.delete(
    '/:id',
    crewOnly,
    asyncHandler(async (req, res) => {
      if (!passengers.delete(req.params.id)) throw notFound();
      res.status(204).end();
    }),
  );

  return router;
}
