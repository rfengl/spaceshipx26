// Membership tiers. Order matters: higher tiers inherit lower-tier access.
export const MEMBERSHIP_LEVELS = ['SILVER', 'GOLD', 'PLATINUM'] as const;

export type MembershipLevel = (typeof MEMBERSHIP_LEVELS)[number];

export function isMembershipLevel(value: unknown): value is MembershipLevel {
  return (
    typeof value === 'string' && (MEMBERSHIP_LEVELS as readonly string[]).includes(value)
  );
}

// Tier rank for inheritance (higher rank includes all lower tiers' access).
const RANK: Record<MembershipLevel, number> = { SILVER: 1, GOLD: 2, PLATINUM: 3 };

export const tierRank = (level: MembershipLevel): number => RANK[level];

/** Whether a member of `userLevel` may access a resource needing `minLevel`. */
export const hasAccess = (
  userLevel: MembershipLevel,
  minLevel: MembershipLevel,
): boolean => RANK[userLevel] >= RANK[minLevel];
