import jwt, { type SignOptions } from 'jsonwebtoken';

import type { AuthUser, Role } from '../../domain/models.js';
import type { TokenService } from '../../domain/ports/tokenService.js';

interface JwtClaims {
  sub: string;
  username: string;
  role: Role;
  passengerId?: string;
  crewLeadId?: string;
}

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  sign(user: AuthUser): string {
    const claims: JwtClaims = {
      sub: user.id,
      username: user.username,
      role: user.role,
      ...(user.passengerId ? { passengerId: user.passengerId } : {}),
      ...(user.crewLeadId ? { crewLeadId: user.crewLeadId } : {}),
    };
    return jwt.sign(claims, this.secret, {
      expiresIn: this.expiresIn,
    } as SignOptions);
  }

  verify(token: string): AuthUser {
    const claims = jwt.verify(token, this.secret) as JwtClaims;
    return {
      id: claims.sub,
      username: claims.username,
      role: claims.role,
      ...(claims.passengerId ? { passengerId: claims.passengerId } : {}),
      ...(claims.crewLeadId ? { crewLeadId: claims.crewLeadId } : {}),
    };
  }
}
