import type { DB } from '../db/connection.js';
import type { RefillLog, Resource } from '../domain/models.js';
import type { ResourceRepository } from '../domain/ports/resourceRepository.js';
import type { RefillLogRepository } from '../domain/ports/refillLogRepository.js';
import type { HttpError } from '../types.js';

const httpError = (status: number, message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = status;
  return err;
};

export interface RefillResult {
  resource: Resource;
  log: RefillLog;
}

/**
 * Crew-lead stock management. Refilling a resource atomically adds units back
 * (never above its maximum) and writes an audit log of who refilled what.
 */
export class InventoryService {
  constructor(
    private readonly resources: ResourceRepository,
    private readonly refillLogs: RefillLogRepository,
    private readonly db: DB,
  ) {}

  /** Add `amount` units to a resource's stock, capped at its maximum. */
  refill(userId: string, resourceId: string, amount: number): RefillResult {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw httpError(400, 'Refill amount must be a positive whole number');
    }

    const resource = this.resources.findById(resourceId);
    if (!resource) throw httpError(404, 'Resource not found');
    if (!resource.active) {
      throw httpError(409, 'This resource is decommissioned and cannot be refilled');
    }
    if (resource.remainingQty + amount > resource.maxQty) {
      const room = resource.maxQty - resource.remainingQty;
      throw httpError(
        400,
        `Refill would exceed the maximum quantity (${resource.maxQty}); at most ${room} more can be added`,
      );
    }

    const apply = this.db.transaction((): RefillResult => {
      const updated = this.resources.addRemaining(resourceId, amount);
      if (!updated) throw httpError(409, 'Refill would exceed the maximum quantity');
      const log = this.refillLogs.record({ userId, resourceId, amount });
      return { resource: updated, log };
    });
    return apply();
  }
}
