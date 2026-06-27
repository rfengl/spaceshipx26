import type { MembershipLevel } from './membership.js';

export type Role = 'CREW_LEAD' | 'PASSENGER';

// A person aboard the ship. Crew leads are users with isCrewLead = true.
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  membershipLevel: MembershipLevel;
  isCrewLead: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Safe shape returned to clients / used in lists (never exposes the hash).
export type PublicUser = Omit<User, 'passwordHash'>;

export const toPublicUser = (user: User): PublicUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
};

export interface NewUser {
  username: string;
  passwordHash: string;
  name: string;
  membershipLevel: MembershipLevel;
  isCrewLead?: boolean;
}

export interface UserUpdate {
  name?: string;
  membershipLevel?: MembershipLevel;
  username?: string;
  passwordHash?: string;
}

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

export interface UsageLog {
  id: string;
  userId: string;
  resourceId: string;
  usedAt: string;
}

// Identity carried in the JWT. `role` is derived from isCrewLead at login.
export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

// --- Crew-lead change requests (propose → approve swap) ---

export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ChangeRequest {
  id: string;
  proposerId: string;
  demoteId: string;
  promoteId: string;
  status: ChangeRequestStatus;
  approverId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface NewChangeRequest {
  proposerId: string;
  demoteId: string;
  promoteId: string;
}
