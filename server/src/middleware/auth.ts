import type { RequestHandler } from 'express';

import type { AuthUser, Role } from '../domain/models.js';
import type { TokenService } from '../domain/ports/tokenService.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
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

/**
 * Verifies the `Authorization: Bearer <jwt>` header and attaches `req.user`.
 * The token authenticates (proves identity, statelessly); the *role* is then
 * re-read from the database so authorization is always current — e.g. a crew
 * lead who was just demoted loses crew powers immediately, not at token expiry.
 */
export function createAuthenticate(
  tokens: TokenService,
  users: UserRepository,
): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(unauthorized());
    }

    let claims: AuthUser;
    try {
      claims = tokens.verify(header.slice('Bearer '.length).trim());
    } catch {
      return next(unauthorized('Invalid or expired token'));
    }

    const user = users.findById(claims.id);
    if (!user) {
      // Token is valid but the account is gone.
      return next(unauthorized('Account no longer exists'));
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.isCrewLead ? 'CREW_LEAD' : 'PASSENGER',
    };
    next();
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
