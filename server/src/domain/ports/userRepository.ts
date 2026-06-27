import type { NewUser, User, UserUpdate } from '../models.js';

export interface UserRepository {
  create(input: NewUser): User;
  findById(id: string): User | null;
  findByUsername(username: string): User | null;
  /** Regular passengers (is_crew_lead = 0). */
  findPassengers(): User[];
  /** Crew leads (is_crew_lead = 1). */
  findCrewLeads(): User[];
  countCrewLeads(): number;
  update(id: string, changes: UserUpdate): User | null;
  /** Toggle crew-lead status (used by the swap workflow). */
  setCrewLead(id: string, isCrewLead: boolean): User | null;
  /** Soft delete: flag the account inactive (rows are never hard-deleted). */
  deactivate(id: string): User | null;
}
