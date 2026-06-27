import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type {
  RecordUsage,
  UsageLogRepository,
} from '../../domain/ports/usageLogRepository.js';
import type { UsageLog } from '../../domain/models.js';

interface UsageLogRow {
  id: string;
  user_id: string;
  resource_id: string;
  used_at: string;
}

const toModel = (row: UsageLogRow): UsageLog => ({
  id: row.id,
  userId: row.user_id,
  resourceId: row.resource_id,
  usedAt: row.used_at,
});

export class SqliteUsageLogRepository implements UsageLogRepository {
  constructor(private readonly db: DB) {}

  record(input: RecordUsage): UsageLog {
    const row: UsageLogRow = {
      id: randomUUID(),
      user_id: input.userId,
      resource_id: input.resourceId,
      used_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        'INSERT INTO usage_logs (id, user_id, resource_id, used_at) VALUES (?, ?, ?, ?)',
      )
      .run(row.id, row.user_id, row.resource_id, row.used_at);
    return toModel(row);
  }

  findByUser(userId: string): UsageLog[] {
    const rows = this.db
      .prepare('SELECT * FROM usage_logs WHERE user_id = ? ORDER BY used_at')
      .all(userId) as UsageLogRow[];
    return rows.map(toModel);
  }

  findAll(): UsageLog[] {
    const rows = this.db
      .prepare('SELECT * FROM usage_logs ORDER BY used_at')
      .all() as UsageLogRow[];
    return rows.map(toModel);
  }
}
