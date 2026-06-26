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

export async function deleteResource(id: string): Promise<void> {
  await apiFetch<void>(`/api/resources/${id}`, { method: 'DELETE' });
}
