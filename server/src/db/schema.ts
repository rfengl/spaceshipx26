// Database schema for the Passenger Resource Management System.
// Kept as an inlined string (not a .sql file) so it ships with the compiled
// output without an extra copy step in the build.
export const SCHEMA = `
-- Everyone aboard is a user. A crew lead is a user with is_crew_lead = 1;
-- a regular passenger has is_crew_lead = 0.
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  username          TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  name              TEXT NOT NULL,
  membership_level  TEXT NOT NULL CHECK (membership_level IN ('SILVER','GOLD','PLATINUM')),
  is_crew_lead      INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT
);

CREATE TABLE IF NOT EXISTS resources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  min_level   TEXT NOT NULL CHECK (min_level IN ('SILVER','GOLD','PLATINUM')),
  max_qty     INTEGER NOT NULL DEFAULT 1 CHECK (max_qty >= 1),
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id  TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  used_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_user     ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_resource ON usage_logs(resource_id);

-- A proposed crew-lead swap (demote one crew lead, promote one passenger).
-- Stays PENDING until a different crew lead approves, keeping exactly 3.
CREATE TABLE IF NOT EXISTS crew_lead_change_requests (
  id           TEXT PRIMARY KEY,
  proposer_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  demote_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promote_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  approver_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  resolved_at  TEXT
);
`;
