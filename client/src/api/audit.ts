import { apiFetch } from './client';

export type AuditAction = 'USE' | 'REFILL';

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
