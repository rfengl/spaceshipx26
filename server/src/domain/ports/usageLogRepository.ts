import type { UsageLog } from '../models.js';

export interface RecordUsage {
  userId: string;
  resourceId: string;
}

export interface ResourceDemand {
  resourceId: string;
  uses: number;
}

export interface UsageLogRepository {
  record(input: RecordUsage): UsageLog;
  findByUser(userId: string): UsageLog[];
  findAll(): UsageLog[];
  /** Resources ranked by usage count (highest demand first). */
  topResources(limit: number): ResourceDemand[];
}
