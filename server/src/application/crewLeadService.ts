import type { DB } from '../db/connection.js';
import type { ChangeRequest, PublicUser } from '../domain/models.js';
import { toPublicUser } from '../domain/models.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
import type { ChangeRequestRepository } from '../domain/ports/changeRequestRepository.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  serverError,
} from '../utils/httpError.js';

/**
 * Crew-lead governance. A crew lead proposes swapping a crew lead with a
 * passenger; the swap only applies once a *different* crew lead approves it,
 * keeping the crew-lead count fixed at three.
 */
export class CrewLeadService {
  constructor(
    private readonly users: UserRepository,
    private readonly requests: ChangeRequestRepository,
    private readonly db: DB,
  ) {}

  listCrewLeads(): PublicUser[] {
    return this.users.findCrewLeads().map(toPublicUser);
  }

  listRequests(): ChangeRequest[] {
    return this.requests.findAll();
  }

  propose(proposerId: string, demoteId: string, promoteId: string): ChangeRequest {
    const proposer = this.users.findById(proposerId);
    if (!proposer?.isCrewLead) {
      throw forbidden('Only crew leads can propose changes');
    }
    if (demoteId === proposerId) {
      throw badRequest('You cannot propose to demote yourself');
    }
    if (demoteId === promoteId) {
      throw badRequest('Demote and promote must be different people');
    }

    const demote = this.users.findById(demoteId);
    if (!demote?.isCrewLead) {
      throw badRequest('The person to demote must be a current crew lead');
    }
    const promote = this.users.findById(promoteId);
    if (!promote) {
      throw notFound('The passenger to promote was not found');
    }
    if (promote.isCrewLead) {
      throw badRequest('The person to promote is already a crew lead');
    }

    if (this.requests.findPending().length > 0) {
      throw conflict('There is already a pending change request');
    }

    return this.requests.create({ proposerId, demoteId, promoteId });
  }

  approve(requestId: string, approverId: string): ChangeRequest {
    const request = this.requirePending(requestId);
    this.assertApprover(approverId, request);

    // Re-validate the targets in case state changed since the proposal.
    const demote = this.users.findById(request.demoteId);
    const promote = this.users.findById(request.promoteId);
    if (!demote?.isCrewLead) {
      throw conflict('The crew lead to demote is no longer valid');
    }
    if (!promote || promote.isCrewLead) {
      throw conflict('The passenger to promote is no longer valid');
    }

    const apply = this.db.transaction((): ChangeRequest => {
      this.users.setCrewLead(request.demoteId, false);
      this.users.setCrewLead(request.promoteId, true);
      const resolved = this.requests.resolve(requestId, 'APPROVED', approverId);
      if (!resolved) throw serverError('Failed to resolve request');
      return resolved;
    });
    return apply();
  }

  reject(requestId: string, approverId: string): ChangeRequest {
    const request = this.requirePending(requestId);
    this.assertApprover(approverId, request);
    const resolved = this.requests.resolve(requestId, 'REJECTED', approverId);
    if (!resolved) throw serverError('Failed to resolve request');
    return resolved;
  }

  private requirePending(requestId: string): ChangeRequest {
    const request = this.requests.findById(requestId);
    if (!request) throw notFound('Change request not found');
    if (request.status !== 'PENDING') {
      throw conflict('Change request is no longer pending');
    }
    return request;
  }

  private assertApprover(approverId: string, request: ChangeRequest): void {
    const approver = this.users.findById(approverId);
    if (!approver?.isCrewLead) {
      throw forbidden('Only crew leads can approve or reject');
    }
    if (approverId === request.proposerId) {
      throw forbidden('The proposer cannot approve their own request');
    }
  }
}
