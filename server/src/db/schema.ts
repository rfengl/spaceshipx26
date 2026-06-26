// Database schema for the Passenger Resource Management System.
// Kept as an inlined string (not a .sql file) so it ships with the compiled
// output without an extra copy step in the build.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS crew_leads (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passengers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  membership_level  TEXT NOT NULL CHECK (membership_level IN ('SILVER','GOLD','PLATINUM')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT
);

CREATE TABLE IF NOT EXISTS resources (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  min_level   TEXT NOT NULL CHECK (min_level IN ('SILVER','GOLD','PLATINUM')),
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id            TEXT PRIMARY KEY,
  passenger_id  TEXT NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  resource_id   TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  used_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_passenger ON usage_logs(passenger_id);
CREATE INDEX IF NOT EXISTS idx_usage_resource  ON usage_logs(resource_id);
`;
