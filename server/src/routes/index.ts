import { Router, type RequestHandler } from 'express';

import type { Container } from '../container.js';
import healthRouter from './health.js';
import { createAuthRouter } from './auth.js';

export function createApiRouter(
  container: Container,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      name: 'SpaceshipX26 PRMS API',
      version: '1.0.0',
      endpoints: ['/api/health', '/api/auth/login', '/api/auth/me'],
    });
  });

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(container.authService, authenticate));

  return router;
}
