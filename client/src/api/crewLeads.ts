import { apiFetch } from './client';
import type { ChangeRequest, Passenger } from '../types';

interface Wrapped<T> {
  data: T;
}

export async function listCrewLeads(): Promise<Passenger[]> {
  return (await apiFetch<Wrapped<Passenger[]>>('/api/crew-leads')).data;
}

export async function listRequests(): Promise<ChangeRequest[]> {
  return (await apiFetch<Wrapped<ChangeRequest[]>>('/api/crew-leads/requests')).data;
}

export async function proposeSwap(
  demoteId: string,
  promoteId: string,
): Promise<ChangeRequest> {
  return (
    await apiFetch<Wrapped<ChangeRequest>>('/api/crew-leads/requests', {
      method: 'POST',
      body: JSON.stringify({ demoteId, promoteId }),
    })
  ).data;
}

export async function approveRequest(id: string): Promise<ChangeRequest> {
  return (
    await apiFetch<Wrapped<ChangeRequest>>(`/api/crew-leads/requests/${id}/approve`, {
      method: 'POST',
    })
  ).data;
}

export async function rejectRequest(id: string): Promise<ChangeRequest> {
  return (
    await apiFetch<Wrapped<ChangeRequest>>(`/api/crew-leads/requests/${id}/reject`, {
      method: 'POST',
    })
  ).data;
}
