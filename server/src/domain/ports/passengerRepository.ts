import type { MembershipLevel } from '../membership.js';
import type { NewPassenger, Passenger } from '../models.js';

export interface PassengerRepository {
  create(input: NewPassenger): Passenger;
  findById(id: string): Passenger | null;
  findAll(): Passenger[];
  setMembershipLevel(id: string, level: MembershipLevel): Passenger | null;
  delete(id: string): boolean;
}
