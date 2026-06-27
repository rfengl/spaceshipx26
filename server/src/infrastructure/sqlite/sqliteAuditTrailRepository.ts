import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { AuditEntry } from '../../domain/models.js';
import type {
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
         a.resource_id AS resourceId,
         r.name        AS resourceName,
         a.amount      AS amount,
         a.note        AS note,
         a.created_at  AS at
  FROM audit_trail a
  JOIN users u     ON u.id = a.user_id
  JOIN resources r ON r.id = a.resource_id
`;

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

  recent(limit: number): AuditEntry[] {
    return this.db
      .prepare(`${ENRICHED} ORDER BY at DESC LIMIT ?`)
      .all(limit) as AuditEntry[];
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
