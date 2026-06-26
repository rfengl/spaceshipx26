import type { MembershipLevel } from './membership.js';

export type Role = 'CREW_LEAD' | 'PASSENGER';

export interface CrewLead {
  id: string;
  name: string;
  createdAt: string;
}

export interface Passenger {
  id: string;
  name: string;
  membershipLevel: MembershipLevel;
  createdAt: string;
  updatedAt?: string;
}

export interface Resource {
  id: string;
  name: string;
  category: string;
  minLevel: MembershipLevel;
  active: boolean;
  createdAt: string;
}

export interface UsageLog {
  id: string;
  passengerId: string;
  resourceId: string;
  usedAt: string;
}

// Input shapes (no server-generated fields like id / timestamps).
export interface NewCrewLead {
  name: string;
}

export interface NewPassenger {
  name: string;
  membershipLevel: MembershipLevel;
}

export interface NewResource {
  name: string;
  category: string;
  minLevel: MembershipLevel;
}

// --- Authentication ---

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  passengerId?: string;
  crewLeadId?: string;
  createdAt: string;
}

export interface NewUser {
  username: string;
  passwordHash: string;
  role: Role;
  passengerId?: string;
  crewLeadId?: string;
}

// Safe identity carried in the JWT and returned to the client (never the hash).
export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  passengerId?: string;
  crewLeadId?: string;
}
