import type { AuthUser } from '../domain/models.js';
import type { PasswordHasher } from '../domain/ports/passwordHasher.js';
import type { TokenService } from '../domain/ports/tokenService.js';
import type { UserRepository } from '../domain/ports/userRepository.js';
import { unauthorized } from '../utils/httpError.js';

export interface LoginResult {
  token: string;
  user: AuthUser;
}

const invalidCredentials = () => unauthorized('Invalid username or password');

// A valid bcrypt hash (cost 10) to compare against when no user is found, so a
// missing username costs the same as a wrong password — no timing oracle for
// enumerating valid usernames.
const DUMMY_HASH = '$2b$10$Or8FEIhGsppQmxsMTc.ly.IiY4ydPFhemqYtFG.5ZfnBhDLzGt.eO';

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = this.users.findByUsername(username);
    // Always run a real bcrypt comparison — against the stored hash, or a dummy
    // of equal cost when the username doesn't exist — so timing doesn't reveal
    // which usernames are valid. Then fail uniformly.
    const ok = await this.hasher.compare(password, user?.passwordHash ?? DUMMY_HASH);
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
