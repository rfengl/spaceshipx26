import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { MembershipLevel } from '../../domain/membership.js';
import type {
  ResourceRepository,
  ResourceUpdate,
} from '../../domain/ports/resourceRepository.js';
import type { NewResource, Resource } from '../../domain/models.js';

interface ResourceRow {
  id: string;
  name: string;
  min_level: MembershipLevel;
  max_qty: number;
  remaining_qty: number;
  active: number;
  created_at: string;
}

const toModel = (row: ResourceRow): Resource => ({
  id: row.id,
  name: row.name,
  minLevel: row.min_level,
  maxQty: row.max_qty,
  remainingQty: row.remaining_qty,
  active: row.active === 1,
  createdAt: row.created_at,
});

export class SqliteResourceRepository implements ResourceRepository {
  constructor(private readonly db: DB) {}

  create(input: NewResource): Resource {
    const row: ResourceRow = {
      id: randomUUID(),
      name: input.name,
      min_level: input.minLevel,
      max_qty: input.maxQty,
      remaining_qty: input.remainingQty ?? input.maxQty,
      active: 1,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO resources (id, name, min_level, max_qty, remaining_qty, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        row.id,
        row.name,
        row.min_level,
        row.max_qty,
        row.remaining_qty,
        row.active,
        row.created_at,
      );
    return toModel(row);
  }

  findById(id: string): Resource | null {
    const row = this.db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as
      | ResourceRow
      | undefined;
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

  update(id: string, changes: ResourceUpdate): Resource | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const name = changes.name ?? existing.name;
    const minLevel = changes.minLevel ?? existing.minLevel;
    const maxQty = changes.maxQty ?? existing.maxQty;
    const active = (changes.active ?? existing.active) ? 1 : 0;
    this.db
      .prepare(
        'UPDATE resources SET name = ?, min_level = ?, max_qty = ?, active = ? WHERE id = ?',
      )
      .run(name, minLevel, maxQty, active, id);
    return this.findById(id);
  }

  deactivate(id: string): Resource | null {
    const changed = this.db
      .prepare('UPDATE resources SET active = 0 WHERE id = ?')
      .run(id).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  decrementRemaining(id: string): Resource | null {
    const changed = this.db
      .prepare(
        'UPDATE resources SET remaining_qty = remaining_qty - 1 WHERE id = ? AND remaining_qty > 0',
      )
      .run(id).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM resources WHERE id = ?').run(id).changes > 0;
  }
}
