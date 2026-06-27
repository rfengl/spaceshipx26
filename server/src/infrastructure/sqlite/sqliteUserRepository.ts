import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { MembershipLevel } from '../../domain/membership.js';
import type { UserRepository } from '../../domain/ports/userRepository.js';
import type { NewUser, User, UserUpdate } from '../../domain/models.js';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  membership_level: MembershipLevel;
  is_crew_lead: number;
  active: number;
  created_at: string;
  updated_at: string | null;
}

const toModel = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  name: row.name,
  membershipLevel: row.membership_level,
  isCrewLead: row.is_crew_lead === 1,
  active: row.active === 1,
  createdAt: row.created_at,
  ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
});

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: DB) {}

  create(input: NewUser): User {
    const row: UserRow = {
      id: randomUUID(),
      username: input.username,
      password_hash: input.passwordHash,
      name: input.name,
      membership_level: input.membershipLevel,
      is_crew_lead: input.isCrewLead ? 1 : 0,
      active: 1,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    this.db
      .prepare(
        `INSERT INTO users (id, username, password_hash, name, membership_level, is_crew_lead, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.username,
        row.password_hash,
        row.name,
        row.membership_level,
        row.is_crew_lead,
        row.created_at,
      );
    return toModel(row);
  }

  findById(id: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | UserRow
      | undefined;
    return row ? toModel(row) : null;
  }

  findByUsername(username: string): User | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;
    return row ? toModel(row) : null;
  }

  findPassengers(): User[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM users WHERE is_crew_lead = 0 AND active = 1 ORDER BY created_at',
      )
      .all() as UserRow[];
    return rows.map(toModel);
  }

  findCrewLeads(): User[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM users WHERE is_crew_lead = 1 AND active = 1 ORDER BY created_at',
      )
      .all() as UserRow[];
    return rows.map(toModel);
  }

  countCrewLeads(): number {
    const { n } = this.db
      .prepare('SELECT COUNT(*) AS n FROM users WHERE is_crew_lead = 1 AND active = 1')
      .get() as { n: number };
    return n;
  }

  update(id: string, changes: UserUpdate): User | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const name = changes.name ?? existing.name;
    const membershipLevel = changes.membershipLevel ?? existing.membershipLevel;
    const username = changes.username ?? existing.username;
    const passwordHash = changes.passwordHash ?? existing.passwordHash;
    this.db
      .prepare(
        `UPDATE users SET name = ?, membership_level = ?, username = ?, password_hash = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(name, membershipLevel, username, passwordHash, new Date().toISOString(), id);
    return this.findById(id);
  }

  setCrewLead(id: string, isCrewLead: boolean): User | null {
    const changed = this.db
      .prepare('UPDATE users SET is_crew_lead = ?, updated_at = ? WHERE id = ?')
      .run(isCrewLead ? 1 : 0, new Date().toISOString(), id).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  // Soft delete: flag the account inactive instead of removing the row, so its
  // history (e.g. usage logs) is preserved. The account can no longer log in.
  deactivate(id: string): User | null {
    const changed = this.db
      .prepare('UPDATE users SET active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id).changes;
    return changed > 0 ? this.findById(id) : null;
  }
}
