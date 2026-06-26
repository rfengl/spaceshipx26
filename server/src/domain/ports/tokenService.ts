import type { AuthUser } from '../models.js';

/** Abstraction over JWT signing/verification. */
export interface TokenService {
  sign(user: AuthUser): string;
  verify(token: string): AuthUser;
}
