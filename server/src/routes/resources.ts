import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { isMembershipLevel } from '../domain/membership.js';
import type { NewResource } from '../domain/models.js';
import type {
  ResourceRepository,
  ResourceUpdate,
} from '../domain/ports/resourceRepository.js';
import type { InventoryService } from '../application/inventoryService.js';
import type { HttpError } from '../types.js';

const badRequest = (message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = 400;
  return err;
};

const notFound = (): HttpError => {
  const err: HttpError = new Error('Resource not found');
  err.status = 404;
  return err;
};

function validateNew(body: unknown): NewResource {
  const { name, minLevel, maxQty } = (body ?? {}) as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('`name` is required');
  }
  if (!isMembershipLevel(minLevel)) {
    throw badRequest('`minLevel` must be SILVER, GOLD, or PLATINUM');
  }
  if (!Number.isInteger(maxQty) || (maxQty as number) < 1) {
    throw badRequest('`maxQty` must be a positive integer');
  }
  return { name: name.trim(), minLevel, maxQty: maxQty as number };
}

function validateUpdate(body: unknown): ResourceUpdate {
  const src = (body ?? {}) as Record<string, unknown>;
  const changes: ResourceUpdate = {};
  if (src.name !== undefined) {
    if (typeof src.name !== 'string' || !src.name.trim())
      throw badRequest('`name` must be a non-empty string');
    changes.name = src.name.trim();
  }
  if (src.minLevel !== undefined) {
    if (!isMembershipLevel(src.minLevel))
      throw badRequest('`minLevel` must be SILVER, GOLD, or PLATINUM');
    changes.minLevel = src.minLevel;
  }
  if (src.maxQty !== undefined) {
    if (!Number.isInteger(src.maxQty) || (src.maxQty as number) < 1)
      throw badRequest('`maxQty` must be a positive integer');
    changes.maxQty = src.maxQty as number;
  }
  if (src.isDecommissioned !== undefined) {
    if (typeof src.isDecommissioned !== 'boolean')
      throw badRequest('`isDecommissioned` must be a boolean');
    changes.isDecommissioned = src.isDecommissioned;
  }
  return changes;
}

export function createResourcesRouter(
  resources: ResourceRepository,
  inventory: InventoryService,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  // Resource management is strictly Crew Lead only.
  router.use(authenticate, requireRole('CREW_LEAD'));

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: resources.findAll() });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      res.status(201).json({ data: resources.create(validateNew(req.body)) });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const updated = resources.update(req.params.id, validateUpdate(req.body));
      if (!updated) throw notFound();
      res.json({ data: updated });
    }),
  );

  // Soft delete: flag the resource inactive (hidden) rather than removing it.
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      if (!resources.deactivate(req.params.id)) throw notFound();
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/refill',
    asyncHandler(async (req, res) => {
      const { amount } = (req.body ?? {}) as Record<string, unknown>;
      const { resource } = inventory.refill(
        req.user!.id,
        req.params.id,
        amount as number,
      );
      res.json({ data: resource });
    }),
  );

  return router;
}
