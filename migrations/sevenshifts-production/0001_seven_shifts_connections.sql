-- D-160: Production-only encrypted 7shifts connection state.
-- Provider tokens never enter Evidence D1, household snapshots, or client storage.
CREATE TABLE IF NOT EXISTS seven_shifts_connections (
  connection_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'production'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ready', 'revoked')),
  state_version INTEGER NOT NULL DEFAULT 1,
  sealed_private TEXT,
  key_version INTEGER NOT NULL DEFAULT 1,
  company_label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_pull_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS seven_shifts_connections_owner
  ON seven_shifts_connections (environment, auth_user_id, household_id, member_id, updated_at);
