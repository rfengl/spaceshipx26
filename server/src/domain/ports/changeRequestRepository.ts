import type { ChangeRequest, ChangeRequestStatus, NewChangeRequest } from '../models.js';

export interface ChangeRequestRepository {
  create(input: NewChangeRequest): ChangeRequest;
  findById(id: string): ChangeRequest | null;
  findAll(): ChangeRequest[];
  findPending(): ChangeRequest[];
  resolve(
    id: string,
    status: ChangeRequestStatus,
    approverId: string,
  ): ChangeRequest | null;
}
