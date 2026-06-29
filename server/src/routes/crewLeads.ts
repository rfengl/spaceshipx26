import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole, currentUser } from '../middleware/auth.js';
import type { CrewLeadService } from '../application/crewLeadService.js';
import { badRequest } from '../utils/httpError.js';

export function createCrewLeadsRouter(
  service: CrewLeadService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const crewOnly = requireRole('CREW_LEAD');

  router.use(authenticate);

  // The crew-lead card view — any authenticated user can see who the crew is.
  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: service.listCrewLeads() });
    }),
  );

  // Change requests are crew-lead governance.
  router.get(
    '/requests',
    crewOnly,
    asyncHandler(async (_req, res) => {
      res.json({ data: service.listRequests() });
    }),
  );

  router.post(
    '/requests',
    crewOnly,
    asyncHandler(async (req, res) => {
      const { demoteId, promoteId } = (req.body ?? {}) as Record<string, unknown>;
      if (typeof demoteId !== 'string' || typeof promoteId !== 'string') {
        throw badRequest('`demoteId` and `promoteId` are required');
      }
      const request = service.propose(currentUser(req).id, demoteId, promoteId);
      res.status(201).json({ data: request });
    }),
  );

  router.post(
    '/requests/:id/approve',
    crewOnly,
    asyncHandler(async (req, res) => {
      res.json({ data: service.approve(req.params.id, currentUser(req).id) });
    }),
  );

  router.post(
    '/requests/:id/reject',
    crewOnly,
    asyncHandler(async (req, res) => {
      res.json({ data: service.reject(req.params.id, currentUser(req).id) });
    }),
  );

  return router;
}
