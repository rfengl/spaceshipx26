import { randomUUID } from 'node:crypto';

import type { DB } from '../../db/connection.js';
import type { ChangeRequestRepository } from '../../domain/ports/changeRequestRepository.js';
import type {
  ChangeRequest,
  ChangeRequestStatus,
  NewChangeRequest,
} from '../../domain/models.js';

interface ChangeRequestRow {
  id: string;
  proposer_id: string;
  demote_id: string;
  promote_id: string;
  status: ChangeRequestStatus;
  approver_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

const toModel = (row: ChangeRequestRow): ChangeRequest => ({
  id: row.id,
  proposerId: row.proposer_id,
  demoteId: row.demote_id,
  promoteId: row.promote_id,
  status: row.status,
  createdAt: row.created_at,
  ...(row.approver_id ? { approverId: row.approver_id } : {}),
  ...(row.resolved_at ? { resolvedAt: row.resolved_at } : {}),
});

export class SqliteChangeRequestRepository implements ChangeRequestRepository {
  constructor(private readonly db: DB) {}

  create(input: NewChangeRequest): ChangeRequest {
    const row: ChangeRequestRow = {
      id: randomUUID(),
      proposer_id: input.proposerId,
      demote_id: input.demoteId,
      promote_id: input.promoteId,
      status: 'PENDING',
      approver_id: null,
      created_at: new Date().toISOString(),
      resolved_at: null,
    };
    this.db
      .prepare(
        `INSERT INTO crew_lead_change_requests
           (id, proposer_id, demote_id, promote_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.proposer_id,
        row.demote_id,
        row.promote_id,
        row.status,
        row.created_at,
      );
    return toModel(row);
  }

  findById(id: string): ChangeRequest | null {
    const row = this.db
      .prepare('SELECT * FROM crew_lead_change_requests WHERE id = ?')
      .get(id) as ChangeRequestRow | undefined;
    return row ? toModel(row) : null;
  }

  findAll(): ChangeRequest[] {
    const rows = this.db
      .prepare('SELECT * FROM crew_lead_change_requests ORDER BY created_at DESC')
      .all() as ChangeRequestRow[];
    return rows.map(toModel);
  }

  findPending(): ChangeRequest[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM crew_lead_change_requests WHERE status = 'PENDING' ORDER BY created_at DESC",
      )
      .all() as ChangeRequestRow[];
    return rows.map(toModel);
  }

  resolve(
    id: string,
    status: ChangeRequestStatus,
    approverId: string,
  ): ChangeRequest | null {
    const changed = this.db
      .prepare(
        'UPDATE crew_lead_change_requests SET status = ?, approver_id = ?, resolved_at = ? WHERE id = ?',
      )
      .run(status, approverId, new Date().toISOString(), id).changes;
    return changed > 0 ? this.findById(id) : null;
  }
}
