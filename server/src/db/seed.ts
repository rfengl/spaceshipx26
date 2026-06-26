import type { DB } from './connection.js';
import type { NewPassenger, NewResource } from '../domain/models.js';
import type { PasswordHasher } from '../domain/ports/passwordHasher.js';
import { SqliteCrewLeadRepository } from '../infrastructure/sqlite/sqliteCrewLeadRepository.js';
import { SqlitePassengerRepository } from '../infrastructure/sqlite/sqlitePassengerRepository.js';
import { SqliteResourceRepository } from '../infrastructure/sqlite/sqliteResourceRepository.js';
import { SqliteUserRepository } from '../infrastructure/sqlite/sqliteUserRepository.js';

// Every seeded account shares this demo password (hashed before storage).
export const DEMO_PASSWORD = 'mars2026';

// Login handle derived from a person's name, e.g. "Ada Lovelace" -> "ada.lovelace".
const handle = (name: string): string => name.toLowerCase().replace(/\s+/g, '.');

// Exactly three Crew Leads (the system's hard limit) ...
const CREW_LEADS = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson'];

// ... six passengers, two per membership tier.
const PASSENGERS: NewPassenger[] = [
  { name: 'Nova Reyes', membershipLevel: 'SILVER' },
  { name: 'Milo Chen', membershipLevel: 'SILVER' },
  { name: 'Priya Anand', membershipLevel: 'GOLD' },
  { name: 'Tomas Vega', membershipLevel: 'GOLD' },
  { name: 'Lena Park', membershipLevel: 'PLATINUM' },
  { name: 'Idris Cole', membershipLevel: 'PLATINUM' },
];

// Base ship inventory, categorized by minimum required tier (from the brief).
const RESOURCES: NewResource[] = [
  { name: 'Food Supply Station', category: 'Food', minLevel: 'SILVER' },
  { name: 'Sleeping Pod', category: 'Rest', minLevel: 'SILVER' },
  { name: 'Basic Hygiene Pod', category: 'Hygiene', minLevel: 'SILVER' },
  { name: 'Private Cabin', category: 'Rest', minLevel: 'GOLD' },
  { name: 'Advanced Medical Bay', category: 'Medical', minLevel: 'GOLD' },
  { name: 'Luxury Oxygen Pod', category: 'Oxygen', minLevel: 'PLATINUM' },
  { name: 'VIP Rec Deck', category: 'Fitness', minLevel: 'PLATINUM' },
];

/**
 * Populates the database with starter data, including a login account per
 * crew lead and passenger (password hashed via the injected hasher).
 * Idempotent: does nothing if the crew leads have already been seeded.
 */
export async function seedDatabase(
  db: DB,
  hasher: PasswordHasher,
): Promise<{ seeded: boolean }> {
  const crewLeads = new SqliteCrewLeadRepository(db);
  if (crewLeads.count() > 0) {
    return { seeded: false };
  }

  const passengers = new SqlitePassengerRepository(db);
  const resources = new SqliteResourceRepository(db);
  const users = new SqliteUserRepository(db);

  // Hash once (all demo accounts share the same password) — bcrypt is async,
  // so this must happen before the synchronous better-sqlite3 transaction.
  const passwordHash = await hasher.hash(DEMO_PASSWORD);

  const insertAll = db.transaction(() => {
    for (const name of CREW_LEADS) {
      const crewLead = crewLeads.create({ name });
      users.create({
        username: handle(name),
        passwordHash,
        role: 'CREW_LEAD',
        crewLeadId: crewLead.id,
      });
    }
    for (const passenger of PASSENGERS) {
      const created = passengers.create(passenger);
      users.create({
        username: handle(passenger.name),
        passwordHash,
        role: 'PASSENGER',
        passengerId: created.id,
      });
    }
    for (const resource of RESOURCES) resources.create(resource);
  });
  insertAll();

  return { seeded: true };
}
