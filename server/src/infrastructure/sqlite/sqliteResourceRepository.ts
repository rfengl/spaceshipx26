import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { MembershipLevel } from '../../domain/membership.js';
import type { ResourceRepository } from '../../domain/ports/resourceRepository.js';
import type { NewResource, Resource } from '../../domain/models.js';

interface ResourceRow {
  id: string;
  name: string;
  category: string;
  min_level: MembershipLevel;
  active: number;
  created_at: string;
}

const toModel = (row: ResourceRow): Resource => ({
  id: row.id,
  name: row.name,
  category: row.category,
  minLevel: row.min_level,
  active: row.active === 1,
  createdAt: row.created_at,
});

export class SqliteResourceRepository implements ResourceRepository {
  constructor(private readonly db: DB) {}

  create(input: NewResource): Resource {
    const row: ResourceRow = {
      id: randomUUID(),
      name: input.name,
      category: input.category,
      min_level: input.minLevel,
      active: 1,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO resources (id, name, category, min_level, active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(row.id, row.name, row.category, row.min_level, row.active, row.created_at);
    return toModel(row);
  }

  findById(id: string): Resource | null {
    const row = this.db
      .prepare('SELECT * FROM resources WHERE id = ?')
      .get(id) as ResourceRow | undefined;
    return row ? toModel(row) : null;
  }

  findAll(): Resource[] {
    const rows = this.db
      .prepare('SELECT * FROM resources ORDER BY created_at')
      .all() as ResourceRow[];
    return rows.map(toModel);
  }

  findActive(): Resource[] {
    const rows = this.db
      .prepare('SELECT * FROM resources WHERE active = 1 ORDER BY created_at')
      .all() as ResourceRow[];
    return rows.map(toModel);
  }

  deactivate(id: string): Resource | null {
    const changed = this.db
      .prepare('UPDATE resources SET active = 0 WHERE id = ?')
      .run(id).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM resources WHERE id = ?').run(id).changes > 0;
  }
}
