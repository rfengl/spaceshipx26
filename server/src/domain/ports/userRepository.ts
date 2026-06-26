import type { NewUser, User } from '../models.js';

export interface UserRepository {
  create(input: NewUser): User;
  findByUsername(username: string): User | null;
  findById(id: string): User | null;
}
