import { apiFetch } from './client';
import type { MembershipLevel, NewResource, Resource } from '../types';

interface Wrapped<T> {
  data: T;
}

export interface ResourceChanges {
  name?: string;
  minLevel?: MembershipLevel;
  maxQty?: number;
  isDecommissioned?: boolean;
}

export async function listResources(): Promise<Resource[]> {
  return (await apiFetch<Wrapped<Resource[]>>('/api/resources')).data;
}

/** Resources available to the current user (filtered by their membership tier). */
export async function listMyResources(): Promise<Resource[]> {
  return (await apiFetch<Wrapped<Resource[]>>('/api/me/resources')).data;
}

/** Resources running lowest on stock, most depleted first (crew-lead analytics). */
export async function getShortages(): Promise<Resource[]> {
  return (await apiFetch<Wrapped<Resource[]>>('/api/reports/shortages')).data;
}

/** Usage count per resource (resourceId → uses), for demand-based sorting. */
export async function getResourceDemand(): Promise<Record<string, number>> {
  const data = (
    await apiFetch<Wrapped<{ resource: Resource; uses: number }[]>>(
      '/api/reports/high-demand?limit=1000',
    )
  ).data;
  return Object.fromEntries(data.map((d) => [d.resource.id, d.uses]));
}

/** Use one unit of a resource; returns the updated resource. */
export async function useResource(id: string): Promise<Resource> {
  return (
    await apiFetch<Wrapped<Resource>>(`/api/me/resources/${id}/use`, {
      method: 'POST',
    })
  ).data;
}

export async function createResource(input: NewResource): Promise<Resource> {
  return (
    await apiFetch<Wrapped<Resource>>('/api/resources', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).data;
}

export async function updateResource(
  id: string,
  changes: ResourceChanges,
): Promise<Resource> {
  return (
    await apiFetch<Wrapped<Resource>>(`/api/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(changes),
    })
  ).data;
}

/** Add stock back to a resource (crew-lead); amount cannot exceed its maximum. */
export async function refillResource(id: string, amount: number): Promise<Resource> {
  return (
    await apiFetch<Wrapped<Resource>>(`/api/resources/${id}/refill`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    })
  ).data;
}

/** Soft-delete a resource (crew-lead): flags it inactive so it is hidden. */
export async function deleteResource(id: string): Promise<void> {
  await apiFetch<void>(`/api/resources/${id}`, { method: 'DELETE' });
}
