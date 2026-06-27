import type { DB } from '../../db/connection.js';
import type { AuditEntry } from '../../domain/models.js';
import type { AuditRepository } from '../../domain/ports/auditRepository.js';

// A use consumes exactly one unit; a refill adds `amount`. Both halves are
// joined to users/resources so the trail reads in plain names, and unioned
// into one timeline ordered newest-first.
const SQL = `
  SELECT * FROM (
    SELECT ul.id          AS id,
           'USE'          AS type,
           ul.user_id     AS userId,
           u.name         AS userName,
           ul.resource_id AS resourceId,
           r.name         AS resourceName,
           1              AS amount,
           ul.used_at     AS at
    FROM usage_logs ul
    JOIN users u     ON u.id = ul.user_id
    JOIN resources r ON r.id = ul.resource_id
    UNION ALL
    SELECT rl.id          AS id,
           'REFILL'       AS type,
           rl.user_id     AS userId,
           u.name         AS userName,
           rl.resource_id AS resourceId,
           r.name         AS resourceName,
           rl.amount      AS amount,
           rl.refilled_at AS at
    FROM refill_logs rl
    JOIN users u     ON u.id = rl.user_id
    JOIN resources r ON r.id = rl.resource_id
  )
  ORDER BY at DESC
  LIMIT ?
`;

export class SqliteAuditRepository implements AuditRepository {
  constructor(private readonly db: DB) {}

  recent(limit: number): AuditEntry[] {
    return this.db.prepare(SQL).all(limit) as AuditEntry[];
  }
}
