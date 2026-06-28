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

// One day's USE count for a resource (day is the YYYY-MM-DD date).
export interface DailyUsage {
  day: string;
  count: number;
}

// USE count for a resource attributed to one membership tier.
export interface TierUsage {
  level: MembershipLevel;
  uses: number;
}

export interface ReportingRepository {
  /** One summary row per membership tier (SILVER → PLATINUM). */
  tierSummary(): TierSummary[];

  /**
   * Daily USE counts for a resource over the last `days` days (inclusive of
   * today), oldest first. Sparse — only days with usage appear.
   */
  dailyUsage(resourceId: string, days: number): DailyUsage[];

  /** USE counts for a resource per membership tier, zero-filled across tiers. */
  usageByTier(resourceId: string): TierUsage[];
}
