import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import type { UsageService } from '../application/usageService.js';

/**
 * Crew-lead analytics. Exposes the highest-demand resources and the resources
 * running lowest on stock, so crew can spot and act on shortages early.
 */
export function createReportsRouter(
  usage: UsageService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate, requireRole('CREW_LEAD'));

  router.get(
    '/high-demand',
    asyncHandler(async (req, res) => {
      // Default to the top 3; allow a larger limit so the crew Resources page
      // can pull demand counts for the whole inventory to sort by.
      const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 3));
      res.json({ data: usage.highDemand(limit) });
    }),
  );

  router.get(
    '/shortages',
    asyncHandler(async (req, res) => {
      const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 3));
      res.json({ data: usage.shortages(limit) });
    }),
  );

  return router;
}
