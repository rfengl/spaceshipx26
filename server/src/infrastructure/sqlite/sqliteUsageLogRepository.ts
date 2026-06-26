import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type {
  RecordUsage,
  UsageLogRepository,
} from '../../domain/ports/usageLogRepository.js';
import type { UsageLog } from '../../domain/models.js';

interface UsageLogRow {
  id: string;
  passenger_id: string;
  resource_id: string;
  used_at: string;
}

const toModel = (row: UsageLogRow): UsageLog => ({
  id: row.id,
  passengerId: row.passenger_id,
  resourceId: row.resource_id,
  usedAt: row.used_at,
});

export class SqliteUsageLogRepository implements UsageLogRepository {
  constructor(private readonly db: DB) {}

  record(input: RecordUsage): UsageLog {
    const row: UsageLogRow = {
      id: randomUUID(),
      passenger_id: input.passengerId,
      resource_id: input.resourceId,
      used_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO usage_logs (id, passenger_id, resource_id, used_at) VALUES (?, ?, ?, ?)',
      )
      .run(row.id, row.passenger_id, row.resource_id, row.used_at);
    return toModel(row);
  }

  findByPassenger(passengerId: string): UsageLog[] {
    const rows = this.db
      .prepare('SELECT * FROM usage_logs WHERE passenger_id = ? ORDER BY used_at')
      .all(passengerId) as UsageLogRow[];
    return rows.map(toModel);
  }

  findAll(): UsageLog[] {
    const rows = this.db
      .prepare('SELECT * FROM usage_logs ORDER BY used_at')
      .all() as UsageLogRow[];
    return rows.map(toModel);
  }
}
