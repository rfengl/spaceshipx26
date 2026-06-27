import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import type { UsageService } from '../application/usageService.js';
import type { AuditTrailRepository } from '../domain/ports/auditTrailRepository.js';
import type { ReportingRepository } from '../domain/ports/reportingRepository.js';

/**
 * Crew-lead analytics. Exposes the highest-demand resources, the resources
 * running lowest on stock, the full resource audit trail, and a ship-wide
 * summary grouped by passenger tier.
 */
export function createReportsRouter(
  usage: UsageService,
  audit: AuditTrailRepository,
  reporting: ReportingRepository,
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

  // Full resource activity trail (usage + refills). Filtering by passenger,
  // resource, and date range is applied on the client.
  router.get(
    '/audit',
    asyncHandler(async (req, res) => {
      const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));
      res.json({ data: audit.recent(limit) });
    }),
  );

  // Ship-wide distribution summary, one row per passenger tier.
  router.get(
    '/aggregate',
    asyncHandler(async (_req, res) => {
      res.json({ data: reporting.tierSummary() });
    }),
  );

  return router;
}
