import { Router, type RequestHandler } from 'express';

import asyncHandler from '../utils/asyncHandler.js';
import type { AuthService } from '../application/authService.js';
import type { HttpError } from '../types.js';

const badRequest = (message: string): HttpError => {
  const err: HttpError = new Error(message);
  err.status = 400;
  return err;
};

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
      if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        throw badRequest('`username` and `password` are required');
      }
      res.json(await authService.login(username, password));
    }),
  );

  // GET /api/auth/me -> current authenticated user
  router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
