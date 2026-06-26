import type { DB } from './connection.js';
import { SCHEMA } from './schema.js';

/** Applies the schema. Idempotent — safe to run on every startup. */
export function migrate(db: DB): void {
  db.exec(SCHEMA);
}
