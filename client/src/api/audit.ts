import { apiFetch } from './client';

export type AuditAction =
  | 'USE'
  | 'REFILL'
  | 'PROVISION'
  | 'DECOMMISSION'
  | 'RECOMMISSION'
  | 'DELETE';

export interface AuditEntry {
  id: string;
  type: AuditAction;
  userId: string;
  userName: string;
  resourceId: string;
  resourceName: string;
  amount: number;
  at: string;
}

/** Full resource activity trail (usage + refills), newest first. Crew-only. */
export async function getAuditTrail(): Promise<AuditEntry[]> {
  return (await apiFetch<{ data: AuditEntry[] }>('/api/reports/audit')).data;
}

/** The current user's own activity history (newest first). */
export async function getMyHistory(): Promise<AuditEntry[]> {
  return (await apiFetch<{ data: AuditEntry[] }>('/api/me/history')).data;
}
