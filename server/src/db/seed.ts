import type { DB } from './connection.js';
import type { MembershipLevel } from '../domain/membership.js';
import type { PasswordHasher } from '../domain/ports/passwordHasher.js';
import { SqliteUserRepository } from '../infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from '../infrastructure/sqlite/sqliteResourceRepository.js';
import { seedAuditTrail, type SimPassenger, type SimResource } from './seedAuditTrail.js';

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

// Base ship inventory, by minimum required tier (from the brief). Every resource
// launches full; the year-long simulation then draws it down and refills it.
const RESOURCES: { name: string; minLevel: MembershipLevel; maxQty: number }[] = [
  { name: 'Food Supply Station', minLevel: 'SILVER', maxQty: 99 },
  { name: 'Sleeping Pod', minLevel: 'SILVER', maxQty: 50 },
  { name: 'Basic Hygiene Pod', minLevel: 'SILVER', maxQty: 30 },
  { name: 'Private Cabin', minLevel: 'GOLD', maxQty: 10 },
  { name: 'Advanced Medical Bay', minLevel: 'GOLD', maxQty: 5 },
  { name: 'Luxury Oxygen Pod', minLevel: 'PLATINUM', maxQty: 8 },
  { name: 'VIP Rec Deck', minLevel: 'PLATINUM', maxQty: 4 },
];

/**
 * Populates the database with starter data: 3 crew leads + 6 passengers and the
 * base resource inventory (full at launch), then hands off to `seedAuditTrail`
 * to simulate a year of usage and refills so the reports and trend views have
 * real history. Idempotent — does nothing if crew leads already exist.
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

  // Hash once (all demo accounts share the same password) — bcrypt is async, so
  // this must happen before the synchronous better-sqlite3 transactions.
  const passwordHash = await hasher.hash(DEMO_PASSWORD);

  // Create the accounts and the full inventory in one transaction.
  const createAll = db.transaction(() => {
    const crewIds = CREW_LEADS.map(
      (name) =>
        users.create({
          username: handle(name),
          passwordHash,
          name,
          membershipLevel: 'PLATINUM',
          isCrewLead: true,
        }).id,
    );

    const simPassengers: SimPassenger[] = PASSENGERS.map((passenger) => {
      const created = users.create({
        username: handle(passenger.name),
        passwordHash,
        name: passenger.name,
        membershipLevel: passenger.membershipLevel,
        isCrewLead: false,
      });
      return { id: created.id, tier: passenger.membershipLevel };
    });

    const simResources: SimResource[] = RESOURCES.map((r) => {
      const created = resources.create(r); // remainingQty defaults to maxQty (full)
      return { ...r, id: created.id, remaining: created.remainingQty };
    });

    return { crewIds, simPassengers, simResources };
  });
  const { crewIds, simPassengers, simResources } = createAll();

  // Simulate a year of activity — each use/refill its own transaction.
  seedAuditTrail(db, simPassengers, simResources, crewIds);

  return { seeded: true };
}
