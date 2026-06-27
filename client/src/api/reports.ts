import { apiFetch } from './client';
import type { MembershipLevel } from '../types';

export interface TierSummary {
  level: MembershipLevel;
  passengers: number;
  resources: number;
  capacity: number;
  remaining: number;
  uses: number;
}

/** Ship-wide distribution summary, one row per passenger tier. Crew-only. */
export async function getAggregateReport(): Promise<TierSummary[]> {
  return (await apiFetch<{ data: TierSummary[] }>('/api/reports/aggregate')).data;
}
