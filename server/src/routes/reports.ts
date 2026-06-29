import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import type { UsageService } from '../application/usageService.js';
import type {
  AuditFilter,
  AuditTrailRepository,
} from '../domain/ports/auditTrailRepository.js';
import type { ReportingRepository } from '../domain/ports/reportingRepository.js';
import type { ResourceRepository } from '../domain/ports/resourceRepository.js';
import { notFound } from '../utils/httpError.js';
import { parsePagination, queryString } from '../utils/pagination.js';

/**
 * Crew-lead analytics. Exposes the highest-demand resources, the resources
 * running lowest on stock, the full resource audit trail, and a ship-wide
 * summary grouped by passenger tier.
 */
export function createReportsRouter(
  usage: UsageService,
  audit: AuditTrailRepository,
  reporting: ReportingRepository,
  resources: ResourceRepository,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate, requireRole('CREW_LEAD'));

  // Per-resource usage analytics: a daily-usage series plus a by-tier breakdown,
  // for the resource trend view. Bundles the resource so the page has its header.
  router.get(
    '/resources/:id/usage',
    asyncHandler(async (req, res) => {
      const resource = resources.findById(req.params.id);
      if (!resource || !resource.active) throw notFound('Resource not found');
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
      res.json({
        data: {
          resource,
          daily: reporting.dailyUsage(resource.id, days),
          byTier: reporting.usageByTier(resource.id),
        },
      });
    }),
  );

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

  // Full resource activity trail (usage + refills + lifecycle), paginated and
  // filtered server-side so the unbounded log never loads in full. Returns the
  // requested page plus the total match count for the client's page control.
  router.get(
    '/audit',
    asyncHandler(async (req, res) => {
      const { limit, offset } = parsePagination(req.query);
      const filter: AuditFilter = {
        userId: queryString(req.query.userId),
        resourceId: queryString(req.query.resourceId),
        from: queryString(req.query.from),
        to: queryString(req.query.to),
      };
      const { entries, total } = audit.search(filter, limit, offset);
      res.json({ data: entries, total });
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
