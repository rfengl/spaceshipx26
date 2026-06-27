import config from './config/index.js';
import type { DB } from './db/connection.js';
import { AuthService } from './application/authService.js';
import { CrewLeadService } from './application/crewLeadService.js';
import { UsageService } from './application/usageService.js';
import type { PasswordHasher } from './domain/ports/passwordHasher.js';
import type { TokenService } from './domain/ports/tokenService.js';
import type { ResourceRepository } from './domain/ports/resourceRepository.js';
import type { UserRepository } from './domain/ports/userRepository.js';
import { SqliteUserRepository } from './infrastructure/sqlite/sqliteUserRepository.js';
import { SqliteResourceRepository } from './infrastructure/sqlite/sqliteResourceRepository.js';
import { SqliteChangeRequestRepository } from './infrastructure/sqlite/sqliteChangeRequestRepository.js';
import { SqliteUsageLogRepository } from './infrastructure/sqlite/sqliteUsageLogRepository.js';
import { BcryptPasswordHasher } from './infrastructure/security/bcryptPasswordHasher.js';
import { JwtTokenService } from './infrastructure/security/jwtTokenService.js';

/**
 * Composition root: wires concrete adapters into the application services.
 * Everything that needs the database is constructed from a single `DB`,
 * so tests can pass an in-memory connection.
 */
export interface Container {
  passwordHasher: PasswordHasher;
  tokenService: TokenService;
  authService: AuthService;
  crewLeadService: CrewLeadService;
  usageService: UsageService;
  userRepository: UserRepository;
  resourceRepository: ResourceRepository;
}

export function buildContainer(db: DB): Container {
  const passwordHasher = new BcryptPasswordHasher();
  const tokenService = new JwtTokenService(config.jwt.secret, config.jwt.expiresIn);

  const userRepository = new SqliteUserRepository(db);
  const resourceRepository = new SqliteResourceRepository(db);
  const changeRequestRepository = new SqliteChangeRequestRepository(db);
  const usageLogRepository = new SqliteUsageLogRepository(db);

  const authService = new AuthService(userRepository, passwordHasher, tokenService);
  const crewLeadService = new CrewLeadService(
    userRepository,
    changeRequestRepository,
    db,
  );
  const usageService = new UsageService(
    userRepository,
    resourceRepository,
    usageLogRepository,
    db,
  );

  return {
    passwordHasher,
    tokenService,
    authService,
    crewLeadService,
    usageService,
    userRepository,
    resourceRepository,
  };
}
