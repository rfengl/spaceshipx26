import type { RequestHandler } from 'express';

import type { Role } from '../domain/models.js';
import type { TokenService } from '../domain/ports/tokenService.js';
import type { HttpError } from '../types.js';

const unauthorized = (message = 'Authentication required'): HttpError => {
  const err: HttpError = new Error(message);
  err.status = 401;
  return err;
};

const forbidden = (): HttpError => {
  const err: HttpError = new Error('Insufficient permissions');
  err.status = 403;
  return err;
};

/** Verifies the `Authorization: Bearer <jwt>` header and attaches `req.user`. */
export function createAuthenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(unauthorized());
    }
    try {
      req.user = tokens.verify(header.slice('Bearer '.length).trim());
      next();
    } catch {
      next(unauthorized('Invalid or expired token'));
    }
  };
}

/** Guards a route to a specific role (use after `authenticate`). */
export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role) return next(forbidden());
    next();
  };
}
