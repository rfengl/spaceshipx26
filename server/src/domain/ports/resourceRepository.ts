import type { MembershipLevel } from '../membership.js';
import type { NewResource, Resource } from '../models.js';

export interface ResourceUpdate {
  name?: string;
  minLevel?: MembershipLevel;
  maxQty?: number;
  active?: boolean;
}

export interface ResourceRepository {
  create(input: NewResource): Resource;
  findById(id: string): Resource | null;
  findAll(): Resource[];
  findActive(): Resource[];
  update(id: string, changes: ResourceUpdate): Resource | null;
  /** Decommission a resource (soft-deactivate). Returns the updated resource. */
  deactivate(id: string): Resource | null;
  /** Atomically consume one unit; null if not found or already at zero. */
  decrementRemaining(id: string): Resource | null;
  /**
   * Atomically add `amount` units to remaining stock without exceeding maxQty.
   * Returns null if not found or the increase would overflow the cap.
   */
  addRemaining(id: string, amount: number): Resource | null;
  delete(id: string): boolean;
}
