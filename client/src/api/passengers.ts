import { apiFetch } from './client';
import type { MembershipLevel, NewPassenger, Passenger } from '../types';

interface Wrapped<T> {
  data: T;
}

export interface PassengerChanges {
  name?: string;
  membershipLevel?: MembershipLevel;
}

export async function listPassengers(): Promise<Passenger[]> {
  return (await apiFetch<Wrapped<Passenger[]>>('/api/passengers')).data;
}

export async function createPassenger(input: NewPassenger): Promise<Passenger> {
  return (
    await apiFetch<Wrapped<Passenger>>('/api/passengers', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).data;
}

export async function updatePassenger(
  id: string,
  changes: PassengerChanges,
): Promise<Passenger> {
  return (
    await apiFetch<Wrapped<Passenger>>(`/api/passengers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(changes),
    })
  ).data;
}

export async function deletePassenger(id: string): Promise<void> {
  await apiFetch<void>(`/api/passengers/${id}`, { method: 'DELETE' });
}
