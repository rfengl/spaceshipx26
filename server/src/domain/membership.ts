// Membership tiers. Order matters: higher tiers inherit lower-tier access.
export const MEMBERSHIP_LEVELS = ['SILVER', 'GOLD', 'PLATINUM'] as const;

export type MembershipLevel = (typeof MEMBERSHIP_LEVELS)[number];

export function isMembershipLevel(value: unknown): value is MembershipLevel {
  return (
    typeof value === 'string' &&
    (MEMBERSHIP_LEVELS as readonly string[]).includes(value)
  );
}
