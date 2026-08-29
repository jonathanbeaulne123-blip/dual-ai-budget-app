-- D-172 autonomous capture registrations and seven-day evidence retirement.
-- This migration is inert until the corresponding Worker flags are enabled.
CREATE TABLE IF NOT EXISTS evidence_companion_registrations (
  registration_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  environment TEXT NOT NULL CHECK (environment = 'production'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS evidence_companion_owner
  ON evidence_companion_registrations (environment, auth_user_id, household_id, member_id, active, created_at);

ALTER TABLE evidence_items ADD COLUMN bible_id TEXT;
ALTER TABLE evidence_items ADD COLUMN resolved_at TEXT;
ALTER TABLE evidence_items ADD COLUMN purge_after TEXT;
ALTER TABLE evidence_items ADD COLUMN purged_at TEXT;
CREATE INDEX IF NOT EXISTS evidence_items_purge_due
  ON evidence_items (environment, state, purge_after)
  WHERE purge_after IS NOT NULL AND purged_at IS NULL;
