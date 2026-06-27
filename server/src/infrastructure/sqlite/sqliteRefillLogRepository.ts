import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type {
  RecordRefill,
  RefillLogRepository,
} from '../../domain/ports/refillLogRepository.js';
import type { RefillLog } from '../../domain/models.js';

interface RefillLogRow {
  id: string;
  user_id: string;
  resource_id: string;
  amount: number;
  refilled_at: string;
}

const toModel = (row: RefillLogRow): RefillLog => ({
  id: row.id,
  userId: row.user_id,
  resourceId: row.resource_id,
  amount: row.amount,
  refilledAt: row.refilled_at,
});

export class SqliteRefillLogRepository implements RefillLogRepository {
  constructor(private readonly db: DB) {}

  record(input: RecordRefill): RefillLog {
    const row: RefillLogRow = {
      id: randomUUID(),
      user_id: input.userId,
      resource_id: input.resourceId,
      amount: input.amount,
      refilled_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO refill_logs (id, user_id, resource_id, amount, refilled_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(row.id, row.user_id, row.resource_id, row.amount, row.refilled_at);
    return toModel(row);
  }

  findByResource(resourceId: string): RefillLog[] {
    const rows = this.db
      .prepare('SELECT * FROM refill_logs WHERE resource_id = ? ORDER BY refilled_at')
      .all(resourceId) as RefillLogRow[];
    return rows.map(toModel);
  }

  findAll(): RefillLog[] {
    const rows = this.db
      .prepare('SELECT * FROM refill_logs ORDER BY refilled_at')
      .all() as RefillLogRow[];
    return rows.map(toModel);
  }
}
