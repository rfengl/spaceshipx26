/** Abstraction over password hashing so the auth logic doesn't depend on bcrypt. */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
