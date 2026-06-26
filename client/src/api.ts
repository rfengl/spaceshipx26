import type { Mission, NewMission } from './types';

// Responses from the Express API are wrapped as { data: ... }.
interface Envelope<T> {
  data: T;
}

const BASE = '/api/missions';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body; keep the default message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listMissions(): Promise<Mission[]> {
  const { data } = await request<Envelope<Mission[]>>(BASE);
  return data;
}

export async function createMission(mission: NewMission): Promise<Mission> {
  const { data } = await request<Envelope<Mission>>(BASE, {
    method: 'POST',
    body: JSON.stringify(mission),
  });
  return data;
}

export async function deleteMission(id: string): Promise<void> {
  await request<void>(`${BASE}/${id}`, { method: 'DELETE' });
}
