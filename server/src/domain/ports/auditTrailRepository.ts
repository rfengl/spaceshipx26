import type { AuditAction, AuditEntry } from '../models.js';

export interface RecordActivity {
  userId: string;
  resourceId: string;
  action: AuditAction;
  amount?: number; // units involved; defaults to 0
  note?: string; // optional context, e.g. a write-off reason
}

export interface ResourceUsage {
  resourceId: string;
  uses: number;
}

export interface AuditTrailRepository {
  /** Append one activity to the trail. */
  record(input: RecordActivity): void;
  /** The whole trail (all activity types), newest first, enriched with names. */
  recent(limit: number): AuditEntry[];
  /** Resources ranked by USE count, highest demand first. */
  topUsed(limit: number): ResourceUsage[];
  /** Enriched entries for one resource (oldest first). */
  findByResource(resourceId: string): AuditEntry[];
  /** Enriched entries for one user (oldest first). */
  findByUser(userId: string): AuditEntry[];
}
