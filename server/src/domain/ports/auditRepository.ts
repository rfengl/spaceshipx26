import type { AuditEntry } from '../models.js';

export interface AuditRepository {
  /**
   * Unified resource activity (passenger uses + crew refills), newest first.
   * Entries are joined to users and resources for display; soft-deleted /
   * decommissioned rows still appear, since their history is preserved.
   */
  recent(limit: number): AuditEntry[];
}
