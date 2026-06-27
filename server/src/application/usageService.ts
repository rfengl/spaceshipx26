import type { DB } from '../db/connection.js';
import { hasAccess } from '../domain/membership.js';
import type { Resource, UsageLog } from '../domain/models.js';
import type { ResourceRepository } from '../domain/ports/resourceRepository.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
import type { UsageLogRepository } from '../domain/ports/usageLogRepository.js';
import type { HttpError } from '../types.js';

const httpError = (status: number, message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = status;
  return err;
};

export interface UseResult {
  resource: Resource;
  log: UsageLog;
}

export interface DemandItem {
  resource: Resource;
  uses: number;
}

/**
 * Resource discovery and consumption for passengers. Consuming a resource
 * atomically decrements its remaining quantity and writes an audit log
 * (who consumed what, and when).
 */
export class UsageService {
  constructor(
    private readonly users: UserRepository,
    private readonly resources: ResourceRepository,
    private readonly usageLogs: UsageLogRepository,
    private readonly db: DB,
  ) {}

  /** The most-used resources (highest demand first). */
  highDemand(limit: number): DemandItem[] {
    return this.usageLogs
      .topResources(limit)
      .map((d) => {
        const resource = this.resources.findById(d.resourceId);
        return resource ? { resource, uses: d.uses } : null;
      })
      .filter((item): item is DemandItem => item !== null);
  }

  /** In-service resources with the lowest remaining stock ratio (most depleted first). */
  shortages(limit: number): Resource[] {
    return this.resources
      .findInService()
      .filter((r) => r.maxQty > 0)
      .sort((a, b) => a.remainingQty / a.maxQty - b.remainingQty / b.maxQty)
      .slice(0, limit);
  }

  /**
   * Resources accessible to the user's membership tier. Decommissioned
   * resources are included (flagged inactive) so passengers can still see them
   * marked as such; the `use` flow rejects them.
   */
  listAvailable(userId: string): Resource[] {
    const user = this.users.findById(userId);
    if (!user) throw httpError(401, 'Account no longer exists');
    return this.resources
      .findAll()
      .filter((r) => hasAccess(user.membershipLevel, r.minLevel));
  }

  /** Record a use: validate, decrement one unit, and write an audit log. */
  use(userId: string, resourceId: string): UseResult {
    const user = this.users.findById(userId);
    if (!user) throw httpError(401, 'Account no longer exists');

    const resource = this.resources.findById(resourceId);
    if (!resource || !resource.active) throw httpError(404, 'Resource not found');
    if (resource.isDecommissioned)
      throw httpError(409, 'This resource is no longer available');
    if (!hasAccess(user.membershipLevel, resource.minLevel)) {
      throw httpError(403, 'Your membership tier cannot access this resource');
    }
    if (resource.remainingQty <= 0) {
      throw httpError(409, 'This resource is out of stock');
    }

    const apply = this.db.transaction((): UseResult => {
      const updated = this.resources.decrementRemaining(resourceId);
      if (!updated) throw httpError(409, 'This resource is out of stock');
      const log = this.usageLogs.record({ userId, resourceId });
      return { resource: updated, log };
    });
    return apply();
  }
}
