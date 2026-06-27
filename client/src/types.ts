export type Role = 'CREW_LEAD' | 'PASSENGER';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

export type MembershipLevel = 'SILVER' | 'GOLD' | 'PLATINUM';

// A person aboard the ship (passenger or crew lead).
export interface Passenger {
  id: string;
  username: string;
  name: string;
  membershipLevel: MembershipLevel;
  isCrewLead: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface NewPassenger {
  username: string;
  password: string;
  name: string;
  membershipLevel: MembershipLevel;
}

export interface Resource {
  id: string;
  name: string;
  minLevel: MembershipLevel;
  maxQty: number;
  remainingQty: number;
  active: boolean;
  createdAt: string;
}

export interface NewResource {
  name: string;
  minLevel: MembershipLevel;
  maxQty: number;
}

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
