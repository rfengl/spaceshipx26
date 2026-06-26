import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import config from '../config/index.js';

export type DB = Database.Database;

/**
 * Opens a SQLite database connection. Accepts an explicit path so callers
 * (e.g. tests) can use ':memory:' instead of the configured file.
 */
export function createDatabase(dbPath: string = config.db.path): DB {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
