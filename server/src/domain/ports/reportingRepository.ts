import type { MembershipLevel } from '../membership.js';

// Ship-wide figures for one membership tier: how many passengers hold it, how
// much resource inventory requires it, and how much has been consumed by
// passengers of that tier.
export interface TierSummary {
  level: MembershipLevel;
  passengers: number;
  resources: number;
  capacity: number; // total max quantity
  remaining: number; // total remaining quantity
  uses: number; // total uses by passengers of this tier
}

export interface ReportingRepository {
  /** One summary row per membership tier (SILVER → PLATINUM). */
  tierSummary(): TierSummary[];
}
