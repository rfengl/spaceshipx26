import type { RefillLog } from '../models.js';

export interface RecordRefill {
  userId: string;
  resourceId: string;
  amount: number;
}

export interface RefillLogRepository {
  record(input: RecordRefill): RefillLog;
  findByResource(resourceId: string): RefillLog[];
  findAll(): RefillLog[];
}
