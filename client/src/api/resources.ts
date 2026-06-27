import { apiFetch } from './client';
import type { MembershipLevel, NewResource, Resource } from '../types';

interface Wrapped<T> {
  data: T;
}

export interface ResourceChanges {
  name?: string;
  minLevel?: MembershipLevel;
  maxQty?: number;
  active?: boolean;
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

export async function deleteResource(id: string): Promise<void> {
  await apiFetch<void>(`/api/resources/${id}`, { method: 'DELETE' });
}
