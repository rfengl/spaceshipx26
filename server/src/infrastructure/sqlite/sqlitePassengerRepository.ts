import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { MembershipLevel } from '../../domain/membership.js';
import type { PassengerRepository } from '../../domain/ports/passengerRepository.js';
import type { NewPassenger, Passenger } from '../../domain/models.js';

interface PassengerRow {
  id: string;
  name: string;
  membership_level: MembershipLevel;
  created_at: string;
  updated_at: string | null;
}

const toModel = (row: PassengerRow): Passenger => ({
  id: row.id,
  name: row.name,
  membershipLevel: row.membership_level,
  createdAt: row.created_at,
  ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
});

export class SqlitePassengerRepository implements PassengerRepository {
  constructor(private readonly db: DB) {}

  create(input: NewPassenger): Passenger {
    const row: PassengerRow = {
      id: randomUUID(),
      name: input.name,
      membership_level: input.membershipLevel,
      created_at: new Date().toISOString(),
      updated_at: null,
    };
    this.db
      .prepare(
        'INSERT INTO passengers (id, name, membership_level, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(row.id, row.name, row.membership_level, row.created_at);
    return toModel(row);
  }

  findById(id: string): Passenger | null {
    const row = this.db
      .prepare('SELECT * FROM passengers WHERE id = ?')
      .get(id) as PassengerRow | undefined;
    return row ? toModel(row) : null;
  }

  findAll(): Passenger[] {
    const rows = this.db
      .prepare('SELECT * FROM passengers ORDER BY created_at')
      .all() as PassengerRow[];
    return rows.map(toModel);
  }

  setMembershipLevel(id: string, level: MembershipLevel): Passenger | null {
    const changed = this.db
      .prepare(
        'UPDATE passengers SET membership_level = ?, updated_at = ? WHERE id = ?',
      )
      .run(level, new Date().toISOString(), id).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM passengers WHERE id = ?').run(id).changes > 0;
  }
}
