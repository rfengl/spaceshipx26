import { apiFetch } from './client';
import type { Passenger } from '../types';

interface Wrapped<T> {
  data: T;
}

export interface ProfileUpdate {
  name?: string;
  username?: string;
  password?: string; // omit/blank to leave unchanged
  currentPassword: string; // required — re-authenticates the change
}

export async function getMyProfile(): Promise<Passenger> {
  return (await apiFetch<Wrapped<Passenger>>('/api/me/profile')).data;
}

export async function updateMyProfile(update: ProfileUpdate): Promise<Passenger> {
  return (
    await apiFetch<Wrapped<Passenger>>('/api/me/profile', {
      method: 'PUT',
      body: JSON.stringify(update),
    })
  ).data;
}
