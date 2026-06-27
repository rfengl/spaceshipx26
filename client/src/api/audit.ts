import { apiFetch } from './client';

export type AuditAction =
  | 'USE'
  | 'REFILL'
  | 'WRITE_OFF'
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
  note: string | null;
  at: string;
}

export interface AuditQuery {
  page: number;
  pageSize: number;
  userId?: string;
  resourceId?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface AuditPage {
  /** The requested page of activity (newest first). */
  data: AuditEntry[];
  /** Total rows matching the filter — used to compute the page count. */
  total: number;
}

/**
 * One filtered, newest-first page of the resource activity trail plus the total
 * match count. Paginated server-side so the unbounded log isn't loaded in full.
 * Crew-only.
 */
export async function getAuditPage(q: AuditQuery): Promise<AuditPage> {
  const params = new URLSearchParams({
    page: String(q.page),
    pageSize: String(q.pageSize),
  });
  if (q.userId) params.set('userId', q.userId);
  if (q.resourceId) params.set('resourceId', q.resourceId);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  return apiFetch<AuditPage>(`/api/reports/audit?${params}`);
}

/** The current user's own activity history (newest first). */
export async function getMyHistory(): Promise<AuditEntry[]> {
  return (await apiFetch<{ data: AuditEntry[] }>('/api/me/history')).data;
}
