import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { AuditEntry } from '../../domain/models.js';
import type {
  AuditFilter,
  AuditPage,
  AuditTrailRepository,
  RecordActivity,
  ResourceUsage,
} from '../../domain/ports/auditTrailRepository.js';

// Joins the trail to users/resources so it reads in plain names. Soft-deleted /
// decommissioned rows still resolve, since their records are preserved.
const ENRICHED = `
  SELECT a.id          AS id,
         a.action      AS type,
         a.user_id     AS userId,
         u.name        AS userName,
         u.membership_level AS userLevel,
         a.resource_id AS resourceId,
         r.name        AS resourceName,
         a.amount      AS amount,
         a.note        AS note,
         a.created_at  AS at
  FROM audit_trail a
  JOIN users u     ON u.id = a.user_id
  JOIN resources r ON r.id = a.resource_id
`;

// Builds a parameterized WHERE clause for the active filters. Values are bound
// as named parameters (never interpolated), and the date bounds compare against
// the YYYY-MM-DD prefix of the ISO timestamp.
function buildWhere(filter: AuditFilter): {
  where: string;
  params: Record<string, string>;
} {
  const conds: string[] = [];
  const params: Record<string, string> = {};
  if (filter.userId) {
    conds.push('a.user_id = @userId');
    params.userId = filter.userId;
  }
  if (filter.resourceId) {
    conds.push('a.resource_id = @resourceId');
    params.resourceId = filter.resourceId;
  }
  if (filter.from) {
    conds.push('substr(a.created_at, 1, 10) >= @from');
    params.from = filter.from;
  }
  if (filter.to) {
    conds.push('substr(a.created_at, 1, 10) <= @to');
    params.to = filter.to;
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

export class SqliteAuditTrailRepository implements AuditTrailRepository {
  constructor(private readonly db: DB) {}

  record(input: RecordActivity): void {
    this.db
      .prepare(
        'INSERT INTO audit_trail (id, user_id, resource_id, action, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        randomUUID(),
        input.userId,
        input.resourceId,
        input.action,
        input.amount ?? 0,
        input.note ?? null,
        new Date().toISOString(),
      );
  }

  search(filter: AuditFilter, limit: number, offset: number): AuditPage {
    const { where, params } = buildWhere(filter);

    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM audit_trail a ${where}`).get(params) as {
        n: number;
      }
    ).n;

    const entries = this.db
      .prepare(
        `${ENRICHED} ${where} ORDER BY a.created_at DESC LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit, offset }) as AuditEntry[];

    return { entries, total };
  }

  topUsed(limit: number): ResourceUsage[] {
    return this.db
      .prepare(
        `SELECT resource_id AS resourceId, COUNT(*) AS uses
         FROM audit_trail
         WHERE action = 'USE'
         GROUP BY resource_id
         ORDER BY uses DESC, resource_id
         LIMIT ?`,
      )
      .all(limit) as ResourceUsage[];
  }

  findByResource(resourceId: string): AuditEntry[] {
    return this.db
      .prepare(`${ENRICHED} WHERE a.resource_id = ? ORDER BY at`)
      .all(resourceId) as AuditEntry[];
  }

  findByUser(userId: string): AuditEntry[] {
    return this.db
      .prepare(`${ENRICHED} WHERE a.user_id = ? ORDER BY at`)
      .all(userId) as AuditEntry[];
  }
}
