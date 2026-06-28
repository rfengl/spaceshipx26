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

// Raw comparison for the chosen column; the caller applies the direction.
function compareByKey(
  a: Resource,
  b: Resource,
  key: SortKey,
  demand: Record<string, number>,
): number {
  switch (key) {
    case 'minLevel':
      return TIER_RANK[a.minLevel] - TIER_RANK[b.minLevel];
    case 'remainingQty':
      return a.remainingQty - b.remainingQty;
    case 'status':
      // In-service first when ascending.
      return Number(a.isDecommissioned) - Number(b.isDecommissioned);
    case 'highDemand':
      // Most-used first when ascending.
      return (demand[b.id] ?? 0) - (demand[a.id] ?? 0);
    case 'shortages':
      // Most-depleted (lowest stock ratio) first when ascending.
      return stockRatio(a) - stockRatio(b);
    default:
      return a.name.localeCompare(b.name);
  }
}

/**
 * Order resources by the chosen column and direction. Pure so the comparator is
 * easy to reason about and unit-test independently of the page. Ties fall back
 * to name order so the result is deterministic regardless of input order.
 */
export function sortResources(
  list: Resource[],
  key: SortKey,
  dir: 'asc' | 'desc',
  demand: Record<string, number>,
): Resource[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const primary = compareByKey(a, b, key, demand) * sign;
    return primary !== 0 ? primary : a.name.localeCompare(b.name);
  });
}
