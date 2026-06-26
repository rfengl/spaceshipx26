import { randomUUID } from 'node:crypto';

export type MissionStatus = 'planned' | 'active' | 'completed';

export interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  crew: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MissionInput {
  name: string;
  status?: MissionStatus;
  crew?: number;
}

// Simple in-memory store. Swap this module for a real database layer
// (Postgres, MongoDB, etc.) without touching the controllers.
const missions = new Map<string, Mission>();

const seed: Array<Omit<Mission, 'id' | 'createdAt'>> = [
  { name: 'Orbit Calibration', status: 'completed', crew: 3 },
  { name: 'Deep Space Relay', status: 'active', crew: 5 },
];

for (const item of seed) {
  const id = randomUUID();
  missions.set(id, { id, createdAt: new Date().toISOString(), ...item });
}

export function list(): Mission[] {
  return [...missions.values()];
}

export function get(id: string): Mission | null {
  return missions.get(id) ?? null;
}

export function create(data: MissionInput): Mission {
  const id = randomUUID();
  const mission: Mission = {
    id,
    name: data.name,
    status: data.status ?? 'planned',
    crew: Number.isFinite(data.crew) ? (data.crew as number) : 0,
    createdAt: new Date().toISOString(),
  };
  missions.set(id, mission);
  return mission;
}

export function update(id: string, data: Partial<Mission>): Mission | null {
  const existing = missions.get(id);
  if (!existing) return null;
  const updated: Mission = {
    ...existing,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  missions.set(id, updated);
  return updated;
}

export function remove(id: string): boolean {
  return missions.delete(id);
}
