import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import type { UsageService } from '../application/usageService.js';

/**
 * "Me" routes — resource discovery and consumption for the current user.
 */
export function createMeRouter(
  usage: UsageService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  // Resources available to the user's membership tier (with remaining/max qty).
  router.get(
    '/resources',
    asyncHandler(async (req, res) => {
      res.json({ data: usage.listAvailable(req.user!.id) });
    }),
  );

  // Use one unit — decrements remaining and records an audit log.
  router.post(
    '/resources/:id/use',
    asyncHandler(async (req, res) => {
      const { resource } = usage.use(req.user!.id, req.params.id);
      res.json({ data: resource });
    }),
  );

  return router;
}
