import type { Resource } from '../types';

/**
 * Value-equality for a Resource. Used to skip no-op state updates: a socket
 * echo of a change we already applied (e.g. our own optimistic update) carries
 * identical data, so returning the previous state lets React bail out of the
 * re-render instead of rebuilding and re-sorting the whole list.
 */
export function sameResource(a: Resource, b: Resource): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.minLevel === b.minLevel &&
    a.maxQty === b.maxQty &&
    a.remainingQty === b.remainingQty &&
    a.active === b.active &&
    a.isDecommissioned === b.isDecommissioned &&
    a.createdAt === b.createdAt
  );
}
