export type Role = 'CREW_LEAD' | 'PASSENGER';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  passengerId?: string;
  crewLeadId?: string;
}
