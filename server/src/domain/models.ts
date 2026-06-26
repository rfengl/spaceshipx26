import type { MembershipLevel } from './membership.js';

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
