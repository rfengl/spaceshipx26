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
  is_decommissioned: number;
  created_at: string;
}

const toModel = (row: ResourceRow): Resource => ({
  id: row.id,
  name: row.name,
  minLevel: row.min_level,
  maxQty: row.max_qty,
  remainingQty: row.remaining_qty,
  active: row.active === 1,
  isDecommissioned: row.is_decommissioned === 1,
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
      is_decommissioned: 0,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO resources (id, name, min_level, max_qty, remaining_qty, active, is_decommissioned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        row.id,
        row.name,
        row.min_level,
        row.max_qty,
        row.remaining_qty,
        row.active,
        row.is_decommissioned,
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

  // Batch lookup (one query) so callers ranking by id don't fan out into N+1.
  findByIds(ids: string[]): Resource[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    const rows = this.db
      .prepare(`SELECT * FROM resources WHERE id IN (${placeholders})`)
      .all(...ids) as ResourceRow[];
    return rows.map(toModel);
  }

  // Non-deleted resources (active = 1), including decommissioned ones (flagged).
  findAll(): Resource[] {
    const rows = this.db
      .prepare('SELECT * FROM resources WHERE active = 1 ORDER BY created_at')
      .all() as ResourceRow[];
    return rows.map(toModel);
  }

  // Non-deleted and in service (usable): active = 1 and not decommissioned.
  findInService(): Resource[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM resources WHERE active = 1 AND is_decommissioned = 0 ORDER BY created_at',
      )
      .all() as ResourceRow[];
    return rows.map(toModel);
  }

  update(id: string, changes: ResourceUpdate): Resource | null {
    const existing = this.findById(id);
    if (!existing) return null;
    const name = changes.name ?? existing.name;
    const minLevel = changes.minLevel ?? existing.minLevel;
    const maxQty = changes.maxQty ?? existing.maxQty;
    const isDecommissioned =
      (changes.isDecommissioned ?? existing.isDecommissioned) ? 1 : 0;
    this.db
      .prepare(
        'UPDATE resources SET name = ?, min_level = ?, max_qty = ?, is_decommissioned = ? WHERE id = ?',
      )
      .run(name, minLevel, maxQty, isDecommissioned, id);
    return this.findById(id);
  }

  decommission(id: string): Resource | null {
    const changed = this.db
      .prepare('UPDATE resources SET is_decommissioned = 1 WHERE id = ?')
      .run(id).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  // Soft delete: flag inactive instead of removing the row (history preserved).
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

  addRemaining(id: string, amount: number): Resource | null {
    const changed = this.db
      .prepare(
        'UPDATE resources SET remaining_qty = remaining_qty + ? WHERE id = ? AND remaining_qty + ? <= max_qty',
      )
      .run(amount, id, amount).changes;
    return changed > 0 ? this.findById(id) : null;
  }

  removeRemaining(id: string, amount: number): Resource | null {
    const changed = this.db
      .prepare(
        'UPDATE resources SET remaining_qty = remaining_qty - ? WHERE id = ? AND remaining_qty >= ?',
      )
      .run(amount, id, amount).changes;
    return changed > 0 ? this.findById(id) : null;
  }
}
