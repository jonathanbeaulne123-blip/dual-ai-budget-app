-- D-148: Development-only Flinks connection state.
-- This file is reviewed migration input. It is not applied by this commit.
CREATE TABLE IF NOT EXISTS flinks_connections (
  connection_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('authorizing', 'completing', 'linked', 'polling', 'ready', 'revoking', 'revoke_pending', 'revoked', 'expired')),
  state_version INTEGER NOT NULL DEFAULT 1,
  sealed_private TEXT,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_poll_at TEXT,
  poll_lease_id TEXT,
  poll_lease_until TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS flinks_connections_owner
  ON flinks_connections (environment, auth_user_id, household_id, member_id, updated_at);
