import type { DB } from '../../db/connection.js';
import { MEMBERSHIP_LEVELS, type MembershipLevel } from '../../domain/membership.js';
import type {
  ReportingRepository,
  TierSummary,
} from '../../domain/ports/reportingRepository.js';

export class SqliteReportingRepository implements ReportingRepository {
  constructor(private readonly db: DB) {}

  tierSummary(): TierSummary[] {
    // Active passengers per tier.
    const passengers = this.db
      .prepare(
        `SELECT membership_level AS level, COUNT(*) AS n
         FROM users WHERE is_crew_lead = 0 AND active = 1
         GROUP BY membership_level`,
      )
      .all() as { level: MembershipLevel; n: number }[];

    // Non-deleted resources grouped by the tier they require.
    const resources = this.db
      .prepare(
        `SELECT min_level AS level,
                COUNT(*)                  AS resources,
                COALESCE(SUM(max_qty), 0) AS capacity,
                COALESCE(SUM(remaining_qty), 0) AS remaining
         FROM resources WHERE active = 1
         GROUP BY min_level`,
      )
      .all() as {
      level: MembershipLevel;
      resources: number;
      capacity: number;
      remaining: number;
    }[];

    // Uses attributed to the consuming passenger's tier.
    const uses = this.db
      .prepare(
        `SELECT u.membership_level AS level, COUNT(*) AS uses
         FROM audit_trail a JOIN users u ON u.id = a.user_id
         WHERE a.action = 'USE'
         GROUP BY u.membership_level`,
      )
      .all() as { level: MembershipLevel; uses: number }[];

    const pByLevel = new Map(passengers.map((r) => [r.level, r.n]));
    const rByLevel = new Map(resources.map((r) => [r.level, r]));
    const uByLevel = new Map(uses.map((r) => [r.level, r.uses]));

    return MEMBERSHIP_LEVELS.map((level) => {
      const r = rByLevel.get(level);
      return {
        level,
        passengers: pByLevel.get(level) ?? 0,
        resources: r?.resources ?? 0,
        capacity: r?.capacity ?? 0,
        remaining: r?.remaining ?? 0,
        uses: uByLevel.get(level) ?? 0,
      };
    });
  }
}
