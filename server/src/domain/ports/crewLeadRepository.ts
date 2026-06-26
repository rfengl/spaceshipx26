import type { CrewLead, NewCrewLead } from '../models.js';

export interface CrewLeadRepository {
  create(input: NewCrewLead): CrewLead;
  findById(id: string): CrewLead | null;
  findAll(): CrewLead[];
  count(): number;
  delete(id: string): boolean;
}
