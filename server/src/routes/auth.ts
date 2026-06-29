import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import type { AuthService } from '../application/authService.js';
import { badRequest } from '../utils/httpError.js';

export function createAuthRouter(
  authService: AuthService,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  // POST /api/auth/login -> { token, user }
  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const { username, password } = req.body ?? {};
      if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        !username ||
        !password
      ) {
        throw badRequest('`username` and `password` are required');
      }
      res.json(await authService.login(username, password));
    }),
  );

  // GET /api/auth/me -> current authenticated user
  router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  // POST /api/auth/refresh -> a fresh token, to keep an active session alive.
  router.post('/refresh', authenticate, (req, res) => {
    res.json(authService.refresh(req.user!));
  });

  return router;
}
