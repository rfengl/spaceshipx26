import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { isMembershipLevel } from '../domain/membership.js';
import type { NewResource } from '../domain/models.js';
import type {
  ResourceRepository,
  ResourceUpdate,
} from '../domain/ports/resourceRepository.js';
import type { AuditTrailRepository } from '../domain/ports/auditTrailRepository.js';
import type { ResourcePublisher } from '../domain/ports/resourcePublisher.js';
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
  audit: AuditTrailRepository,
  publisher: ResourcePublisher,
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
      const created = resources.create(validateNew(req.body));
      audit.record({
        userId: req.user!.id,
        resourceId: created.id,
        action: 'PROVISION',
      });
      publisher.publish({ type: 'resource.updated', resource: created });
      res.status(201).json({ data: created });
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const before = resources.findById(req.params.id);
      if (!before) throw notFound();
      const changes = validateUpdate(req.body);
      const updated = resources.update(req.params.id, changes);
      if (!updated) throw notFound();

      // Record a lifecycle event only when the decommission state flips.
      if (
        changes.isDecommissioned !== undefined &&
        changes.isDecommissioned !== before.isDecommissioned
      ) {
        audit.record({
          userId: req.user!.id,
          resourceId: updated.id,
          action: changes.isDecommissioned ? 'DECOMMISSION' : 'RECOMMISSION',
        });
      }
      publisher.publish({ type: 'resource.updated', resource: updated });
      res.json({ data: updated });
    }),
  );

  // Soft delete: flag the resource inactive (hidden) rather than removing it.
  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      if (!resources.deactivate(req.params.id)) throw notFound();
      audit.record({
        userId: req.user!.id,
        resourceId: req.params.id,
        action: 'DELETE',
      });
      publisher.publish({ type: 'resource.removed', resourceId: req.params.id });
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
      publisher.publish({ type: 'resource.updated', resource });
      res.json({ data: resource });
    }),
  );

  return router;
}
