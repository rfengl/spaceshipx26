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

export interface AuditFilter {
  userId?: string;
  resourceId?: string;
  from?: string; // YYYY-MM-DD, inclusive lower bound on the activity date
  to?: string; // YYYY-MM-DD, inclusive upper bound on the activity date
}

export interface AuditPage {
  /** The requested slice (newest first), enriched with names. */
  entries: AuditEntry[];
  /** Total rows matching the filter, ignoring the slice — drives the page count. */
  total: number;
}

export interface AuditTrailRepository {
  /** Append one activity to the trail. */
  record(input: RecordActivity): void;
  /**
   * A filtered, newest-first slice of the trail plus the total match count, so
   * the whole log never has to be loaded to render one page.
   */
  search(filter: AuditFilter, limit: number, offset: number): AuditPage;
  /** Resources ranked by USE count, highest demand first. */
  topUsed(limit: number): ResourceUsage[];
  /** Enriched entries for one resource (oldest first). */
  findByResource(resourceId: string): AuditEntry[];
  /** Enriched entries for one user (oldest first). */
  findByUser(userId: string): AuditEntry[];
}
