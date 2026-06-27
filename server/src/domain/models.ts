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
  active: boolean;
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
  remainingQty: number;
  active: boolean; // soft-delete flag: false = deleted (hidden)
  isDecommissioned: boolean; // operational flag: true = out of service (flagged)
  createdAt: string;
}

export interface NewResource {
  name: string;
  minLevel: MembershipLevel;
  maxQty: number;
  remainingQty?: number; // defaults to maxQty (full) when omitted
}

// Crew-lead resource lifecycle actions recorded for the audit trail.
export type ResourceEventAction =
  | 'PROVISION'
  | 'DECOMMISSION'
  | 'RECOMMISSION'
  | 'DELETE';

// A single line in the resource audit trail: a passenger use, a crew refill, a
// crew write-off (removing spoiled/broken stock), or a lifecycle action —
// enriched with the actor's and resource's names.
export type AuditAction = 'USE' | 'REFILL' | 'WRITE_OFF' | ResourceEventAction;

export interface AuditEntry {
  id: string;
  type: AuditAction;
  userId: string;
  userName: string;
  resourceId: string;
  resourceName: string;
  amount: number;
  note: string | null;
  at: string;
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
