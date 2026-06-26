export type MissionStatus = 'planned' | 'active' | 'completed';

export interface Mission {
  id: string;
  name: string;
  status: MissionStatus;
  crew: number;
  createdAt: string;
  updatedAt?: string;
}

export interface NewMission {
  name: string;
  status: MissionStatus;
  crew: number;
}
