import { createDatabase, type DB } from './connection.js';
import { migrate } from './migrate.js';

let instance: DB | null = null;

/**
 * Returns the process-wide database connection, creating and migrating it on
 * first use. For isolated connections (tests) use `createDatabase` directly.
 */
export function getDb(): DB {
  if (!instance) {
    instance = createDatabase();
    migrate(instance);
  }
  return instance;
}

export { createDatabase, migrate };
export type { DB };
