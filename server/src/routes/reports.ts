import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import type { UsageService } from '../application/usageService.js';
import type {
  AuditFilter,
  AuditTrailRepository,
} from '../domain/ports/auditTrailRepository.js';
import type { ReportingRepository } from '../domain/ports/reportingRepository.js';

// A trimmed query-string value, or undefined when absent/blank.
const queryString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

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

  // Full resource activity trail (usage + refills + lifecycle), paginated and
  // filtered server-side so the unbounded log never loads in full. Returns the
  // requested page plus the total match count for the client's page control.
  router.get(
    '/audit',
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
      const filter: AuditFilter = {
        userId: queryString(req.query.userId),
        resourceId: queryString(req.query.resourceId),
        from: queryString(req.query.from),
        to: queryString(req.query.to),
      };
      const { entries, total } = audit.search(filter, pageSize, (page - 1) * pageSize);
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
