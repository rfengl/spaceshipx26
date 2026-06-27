import type { DB } from '../db/connection.js';
import type { Resource } from '../domain/models.js';
import type { ResourceRepository } from '../domain/ports/resourceRepository.js';
import type { AuditTrailRepository } from '../domain/ports/auditTrailRepository.js';
import type { HttpError } from '../types.js';

const httpError = (status: number, message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = status;
  return err;
};

export interface RefillResult {
  resource: Resource;
}

/**
 * Crew-lead stock management. Refilling a resource atomically adds units back
 * (never above its maximum) and writes an audit-trail entry of who refilled what.
 */
export class InventoryService {
  constructor(
    private readonly resources: ResourceRepository,
    private readonly audit: AuditTrailRepository,
    private readonly db: DB,
  ) {}

  /** Add `amount` units to a resource's stock, capped at its maximum. */
  refill(userId: string, resourceId: string, amount: number): RefillResult {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw httpError(400, 'Refill amount must be a positive whole number');
    }

    const resource = this.resources.findById(resourceId);
    if (!resource || !resource.active) throw httpError(404, 'Resource not found');
    if (resource.isDecommissioned) {
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
      this.audit.record({ userId, resourceId, action: 'REFILL', amount });
      return { resource: updated };
    });
    return apply();
  }

  /**
   * Write off `amount` units of stock that can no longer be consumed (expired,
   * broken, lost). Decrements remaining (never below zero) and records the
   * reason in the audit trail.
   */
  writeOff(
    userId: string,
    resourceId: string,
    amount: number,
    reason?: string,
  ): RefillResult {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw httpError(400, 'Write-off amount must be a positive whole number');
    }

    const resource = this.resources.findById(resourceId);
    if (!resource || !resource.active) throw httpError(404, 'Resource not found');
    if (amount > resource.remainingQty) {
      throw httpError(
        400,
        `Cannot write off more than the remaining stock (${resource.remainingQty})`,
      );
    }

    const note = reason?.trim() ? reason.trim() : undefined;
    const apply = this.db.transaction((): RefillResult => {
      const updated = this.resources.removeRemaining(resourceId, amount);
      if (!updated) throw httpError(409, 'Not enough stock to write off');
      this.audit.record({ userId, resourceId, action: 'WRITE_OFF', amount, note });
      return { resource: updated };
    });
    return apply();
  }
}
