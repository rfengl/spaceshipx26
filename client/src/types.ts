export type Role = 'CREW_LEAD' | 'PASSENGER';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  passengerId?: string;
  crewLeadId?: string;
}

export type MembershipLevel = 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Resource {
  id: string;
  name: string;
  minLevel: MembershipLevel;
  maxQty: number;
  active: boolean;
  createdAt: string;
}

export interface NewResource {
  name: string;
  minLevel: MembershipLevel;
  maxQty: number;
}
