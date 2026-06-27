import type { DB } from './connection.js';
import type { MembershipLevel } from '../domain/membership.js';
import type { NewResource } from '../domain/models.js';
import type { PasswordHasher } from '../domain/ports/passwordHasher.js';
import { SqliteUserRepository } from '../infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../infrastructure/sqlite/sqliteResourceRepository.js';

// Every seeded account shares this demo password (hashed before storage).
export const DEMO_PASSWORD = 'mars2026';

// Login handle derived from a person's name, e.g. "Ada Lovelace" -> "ada.lovelace".
const handle = (name: string): string => name.toLowerCase().replace(/\s+/g, '.');

// Exactly three crew leads (users with is_crew_lead = 1).
const CREW_LEADS = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson'];

// Six passengers, two per membership tier.
const PASSENGERS: { name: string; membershipLevel: MembershipLevel }[] = [
  { name: 'Nova Reyes', membershipLevel: 'SILVER' },
  { name: 'Milo Chen', membershipLevel: 'SILVER' },
  { name: 'Priya Anand', membershipLevel: 'GOLD' },
  { name: 'Tomas Vega', membershipLevel: 'GOLD' },
  { name: 'Lena Park', membershipLevel: 'PLATINUM' },
  { name: 'Idris Cole', membershipLevel: 'PLATINUM' },
];

// Base ship inventory, by minimum required tier (from the brief).
// remainingQty is seeded with variety so the passenger dashboard shows a mix of
// normal / low (yellow, < 1/2) / critical (red, < 1/3) stock levels.
const RESOURCES: NewResource[] = [
  { name: 'Food Supply Station', minLevel: 'SILVER', maxQty: 20, remainingQty: 18 },
  { name: 'Sleeping Pod', minLevel: 'SILVER', maxQty: 50, remainingQty: 20 },
  { name: 'Basic Hygiene Pod', minLevel: 'SILVER', maxQty: 30, remainingQty: 8 },
  { name: 'Private Cabin', minLevel: 'GOLD', maxQty: 10, remainingQty: 3 },
  { name: 'Advanced Medical Bay', minLevel: 'GOLD', maxQty: 5, remainingQty: 4 },
  { name: 'Luxury Oxygen Pod', minLevel: 'PLATINUM', maxQty: 8, remainingQty: 3 },
  { name: 'VIP Rec Deck', minLevel: 'PLATINUM', maxQty: 4, remainingQty: 4 },
];

/**
 * Populates the database with starter data: 3 crew leads + 6 passengers (all
 * users) and the base resource inventory. Idempotent — does nothing if crew
 * leads already exist, so it is safe to call on every startup.
 */
export async function seedDatabase(
  db: DB,
  hasher: PasswordHasher,
): Promise<{ seeded: boolean }> {
  const users = new SqliteUserRepository(db);
  if (users.countCrewLeads() > 0) {
    return { seeded: false };
  }

  const resources = new SqliteResourceRepository(db);

  // Hash once (all demo accounts share the same password) — bcrypt is async,
  // so this must happen before the synchronous better-sqlite3 transaction.
  const passwordHash = await hasher.hash(DEMO_PASSWORD);

  const insertAll = db.transaction(() => {
    for (const name of CREW_LEADS) {
      users.create({
        username: handle(name),
        passwordHash,
        name,
        membershipLevel: 'PLATINUM',
        isCrewLead: true,
      });
    }
    for (const passenger of PASSENGERS) {
      users.create({
        username: handle(passenger.name),
        passwordHash,
        name: passenger.name,
        membershipLevel: passenger.membershipLevel,
        isCrewLead: false,
      });
    }
    for (const resource of RESOURCES) resources.create(resource);
  });
  insertAll();

  return { seeded: true };
}
