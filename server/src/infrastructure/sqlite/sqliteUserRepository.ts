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
      .prepare('SELECT * FROM users WHERE is_crew_lead = 0 ORDER BY created_at')
      .all() as UserRow[];
    return rows.map(toModel);
  }

  findCrewLeads(): User[] {
    const rows = this.db
      .prepare('SELECT * FROM users WHERE is_crew_lead = 1 ORDER BY created_at')
      .all() as UserRow[];
    return rows.map(toModel);
  }

  countCrewLeads(): number {
    const { n } = this.db
      .prepare('SELECT COUNT(*) AS n FROM users WHERE is_crew_lead = 1')
      .get() as { n: number };
    return n;
  }

  update(id: string, changes: UserUpdate): User | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const name = changes.name ?? existing.name;
    const membershipLevel = changes.membershipLevel ?? existing.membershipLevel;
    this.db
      .prepare(
        'UPDATE users SET name = ?, membership_level = ?, updated_at = ? WHERE id = ?',
      )
      .run(name, membershipLevel, new Date().toISOString(), id);
    return this.findById(id);
  }

  setCrewLead(id: string, isCrewLead: boolean): User | null {
    const changed = this.db
      .prepare('UPDATE users SET is_crew_lead = ?, updated_at = ? WHERE id = ?')
      .run(isCrewLead ? 1 : 0, new Date().toISOString(), id).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  }
}
