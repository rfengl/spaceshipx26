import type { UsageLog } from '../models.js';

export interface RecordUsage {
  passengerId: string;
  resourceId: string;
}

export interface UsageLogRepository {
  record(input: RecordUsage): UsageLog;
  findByPassenger(passengerId: string): UsageLog[];
  findAll(): UsageLog[];
}
