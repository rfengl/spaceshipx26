import type { Request, RequestHandler } from 'express';

import type { AuthUser, Role } from '../domain/models.js';
import type { TokenService } from '../domain/ports/tokenService.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

/**
 * The authenticated user attached by `authenticate`. Use this in handlers
 * mounted behind it instead of `req.user!` — it narrows the type and throws if
 * the middleware was somehow skipped.
 */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

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
    if (!user || !user.active) {
      // Token is valid but the account is gone or was soft-deleted.
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
