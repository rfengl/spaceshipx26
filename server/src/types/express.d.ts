import type { AuthUser } from '../domain/models.js';

// Make the authenticated user available on the Express request.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
