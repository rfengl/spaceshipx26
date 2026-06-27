import { Router, type RequestHandler } from 'express';

import type { Container } from '../container.js';
import healthRouter from './health.js';
import { createAuthRouter } from './auth.js';
import { createResourcesRouter } from './resources.js';
import { createPassengersRouter } from './passengers.js';
import { createCrewLeadsRouter } from './crewLeads.js';
import { createMeRouter } from './me.js';

export function createApiRouter(
  container: Container,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      name: 'SpaceshipX26 PRMS API',
      version: '1.0.0',
      endpoints: [
        '/api/health',
        '/api/auth/login',
        '/api/auth/me',
        '/api/resources',
        '/api/passengers',
        '/api/crew-leads',
        '/api/me/resources',
      ],
    });
  });

  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(container.authService, authenticate));
  router.use(
    '/me',
    createMeRouter(
      container.usageService,
      container.userRepository,
      container.passwordHasher,
      authenticate,
    ),
  );
  router.use(
    '/resources',
    createResourcesRouter(container.resourceRepository, authenticate),
  );
  router.use(
    '/passengers',
    createPassengersRouter(
      container.userRepository,
      container.passwordHasher,
      authenticate,
    ),
  );
  router.use(
    '/crew-leads',
    createCrewLeadsRouter(container.crewLeadService, authenticate),
  );

  return router;
}
