import type { MembershipLevel } from '../membership.js';
import type { NewResource, Resource } from '../models.js';

export interface ResourceUpdate {
  name?: string;
  minLevel?: MembershipLevel;
  maxQty?: number;
  isDecommissioned?: boolean;
}

export interface ResourceRepository {
  create(input: NewResource): Resource;
  findById(id: string): Resource | null;
  /** Non-deleted resources (active), including decommissioned ones. */
  findAll(): Resource[];
  /** Non-deleted resources still in service (not decommissioned). */
  findInService(): Resource[];
  update(id: string, changes: ResourceUpdate): Resource | null;
  /** Decommission (take out of service): sets is_decommissioned = 1. */
  decommission(id: string): Resource | null;
  /** Soft delete: sets active = 0. Rows are never hard-deleted. */
  deactivate(id: string): Resource | null;
  /** Atomically consume one unit; null if not found or already at zero. */
  decrementRemaining(id: string): Resource | null;
  /**
   * Atomically add `amount` units to remaining stock without exceeding maxQty.
   * Returns null if not found or the increase would overflow the cap.
   */
  addRemaining(id: string, amount: number): Resource | null;
  /**
   * Atomically remove `amount` units from remaining stock (e.g. a write-off).
   * Returns null if not found or there isn't enough stock to remove.
   */
  removeRemaining(id: string, amount: number): Resource | null;
}
