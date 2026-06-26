import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { UserRepository } from '../../domain/ports/userRepository.js';
import type { NewUser, Role, User } from '../../domain/models.js';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  passenger_id: string | null;
  crew_lead_id: string | null;
  created_at: string;
}

const toModel = (row: UserRow): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  role: row.role,
  createdAt: row.created_at,
  ...(row.passenger_id ? { passengerId: row.passenger_id } : {}),
  ...(row.crew_lead_id ? { crewLeadId: row.crew_lead_id } : {}),
});

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: DB) {}

  create(input: NewUser): User {
    const row: UserRow = {
      id: randomUUID(),
      username: input.username,
      password_hash: input.passwordHash,
      role: input.role,
      passenger_id: input.passengerId ?? null,
      crew_lead_id: input.crewLeadId ?? null,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO users (id, username, password_hash, role, passenger_id, crew_lead_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.username,
        row.password_hash,
        row.role,
        row.passenger_id,
        row.crew_lead_id,
        row.created_at,
      );
    return toModel(row);
  }

  findByUsername(username: string): User | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;
    return row ? toModel(row) : null;
  }

  findById(id: string): User | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;
    return row ? toModel(row) : null;
  }
}
