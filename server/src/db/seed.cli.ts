import { getDb } from './index.js';
import { seedDatabase } from './seed.js';
import { BcryptPasswordHasher } from '../infrastructure/security/bcryptPasswordHasher.js';

// `npm run seed` — populate the configured database.
const { seeded } = await seedDatabase(getDb(), new BcryptPasswordHasher());
console.log(
  seeded
    ? 'Database seeded: 3 crew leads, 6 passengers, 7 resources, 9 user accounts.'
    : 'Database already contains data; nothing to seed.',
);
