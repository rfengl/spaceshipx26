import type { AuthUser } from '../domain/models.js';
import type { PasswordHasher } from '../domain/ports/passwordHasher.js';
import type { TokenService } from '../domain/ports/tokenService.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
import type { HttpError } from '../types.js';

export interface LoginResult {
  token: string;
  user: AuthUser;
}

const invalidCredentials = (): HttpError => {
  const err: HttpError = new Error('Invalid username or password');
  err.status = 401;
  return err;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = this.users.findByUsername(username);
    // Always run a comparison-shaped path to avoid leaking which usernames
    // exist via timing, then fail uniformly.
    const ok = user ? await this.hasher.compare(password, user.passwordHash) : false;
    // A soft-deleted (inactive) account is treated as if it does not exist.
    if (!user || !ok || !user.active) {
      throw invalidCredentials();
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      role: user.isCrewLead ? 'CREW_LEAD' : 'PASSENGER',
    };
    return { token: this.tokens.sign(authUser), user: authUser };
  }

  /**
   * Issue a fresh token for an already-authenticated user (sliding session).
   * The caller is validated live by the `authenticate` middleware, so `user`
   * already reflects the current role.
   */
  refresh(user: AuthUser): LoginResult {
    return { token: this.tokens.sign(user), user };
  }
}
