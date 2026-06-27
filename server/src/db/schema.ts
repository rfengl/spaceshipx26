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
  -- Soft-delete flag: deleting a passenger sets this to 0; rows are never removed.
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT
);

CREATE TABLE IF NOT EXISTS resources (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  min_level         TEXT NOT NULL CHECK (min_level IN ('SILVER','GOLD','PLATINUM')),
  max_qty           INTEGER NOT NULL DEFAULT 1 CHECK (max_qty >= 1),
  -- Stock can never go negative nor exceed capacity (defence in depth; the
  -- application also guards every adjustment).
  remaining_qty     INTEGER NOT NULL DEFAULT 1 CHECK (remaining_qty >= 0 AND remaining_qty <= max_qty),
  -- Two independent lifecycle flags (rows are never hard-deleted):
  --   active = 0            -> soft-deleted; hidden everywhere.
  --   is_decommissioned = 1 -> taken out of service; still visible, flagged.
  active            INTEGER NOT NULL DEFAULT 1,
  is_decommissioned INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);

-- Single audit trail of every resource activity: passenger usage, crew refills,
-- and crew lifecycle actions (provision / decommission / recommission / delete).
-- \`amount\` is the units involved (1 for a use, N for a refill, 0 otherwise).
CREATE TABLE IF NOT EXISTS audit_trail (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (
                action IN ('USE','REFILL','PROVISION','DECOMMISSION','RECOMMISSION','DELETE','WRITE_OFF')
              ),
  amount      INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_trail(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_trail(action);
-- Supports the newest-first paginated trail (ORDER BY created_at DESC).
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_trail(created_at);

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
