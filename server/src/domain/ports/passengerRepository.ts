import type { MembershipLevel } from '../membership.js';
import type { NewPassenger, Passenger } from '../models.js';

export interface PassengerUpdate {
  name?: string;
  membershipLevel?: MembershipLevel;
}

export interface PassengerRepository {
  create(input: NewPassenger): Passenger;
  findById(id: string): Passenger | null;
  findAll(): Passenger[];
  update(id: string, changes: PassengerUpdate): Passenger | null;
  setMembershipLevel(id: string, level: MembershipLevel): Passenger | null;
  delete(id: string): boolean;
}
