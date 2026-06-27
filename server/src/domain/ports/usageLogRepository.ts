import type { UsageLog } from '../models.js';

export interface RecordUsage {
  userId: string;
  resourceId: string;
}

export interface UsageLogRepository {
  record(input: RecordUsage): UsageLog;
  findByUser(userId: string): UsageLog[];
  findAll(): UsageLog[];
}
