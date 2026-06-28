import { TIER_RANK, type Resource } from '../../types';

export type SortKey =
  | 'name'
  | 'minLevel'
  | 'remainingQty'
  | 'status'
  | 'highDemand'
  | 'shortages';

// Remaining-stock ratio, used by the shortages sort.
const stockRatio = (r: Resource) => (r.maxQty > 0 ? r.remainingQty / r.maxQty : 0);

/**
 * Order resources by the chosen column and direction. Pure so the comparator is
 * easy to reason about and unit-test independently of the page.
 */
export function sortResources(
  list: Resource[],
  key: SortKey,
  dir: 'asc' | 'desc',
  demand: Record<string, number>,
): Resource[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (key) {
      case 'minLevel':
        return (TIER_RANK[a.minLevel] - TIER_RANK[b.minLevel]) * sign;
      case 'remainingQty':
        return (a.remainingQty - b.remainingQty) * sign;
      case 'status':
        // In-service first when ascending.
        return (Number(a.isDecommissioned) - Number(b.isDecommissioned)) * sign;
      case 'highDemand':
        // Most-used first when ascending.
        return ((demand[b.id] ?? 0) - (demand[a.id] ?? 0)) * sign;
      case 'shortages':
        // Most-depleted (lowest stock ratio) first when ascending.
        return (stockRatio(a) - stockRatio(b)) * sign;
      default:
        return a.name.localeCompare(b.name) * sign;
    }
  });
}
