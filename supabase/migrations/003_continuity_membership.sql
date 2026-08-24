-- DO NOT APPLY WITHOUT JONATHAN'S EXPLICIT SCHEMA APPROVAL.
-- D-115 disposable-Development membership discovery and personal scope.
-- This is a continuity bridge, not authentication: the browser still supplies
-- the Google subject until the late-September Supabase Auth/RLS cutover.
-- Order: after 001_hearth_books.sql. It does not require unapplied migration 002.
-- Rollback:
--   DROP TABLE IF EXISTS continuity_personal_snapshots;
--   DROP TABLE IF EXISTS continuity_memberships;

BEGIN;

CREATE TABLE IF NOT EXISTS continuity_memberships (
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  google_subject TEXT NOT NULL DEFAULT '',
  google_email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (environment, household_id, member_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS continuity_membership_subject
  ON continuity_memberships (environment, household_id, google_subject)
  WHERE google_subject <> '' AND active;
CREATE INDEX IF NOT EXISTS continuity_membership_subject_lookup
  ON continuity_memberships (environment, google_subject)
  WHERE active;
CREATE INDEX IF NOT EXISTS continuity_membership_email_lookup
  ON continuity_memberships (environment, google_email)
  WHERE active;

CREATE TABLE IF NOT EXISTS continuity_personal_snapshots (
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (environment, household_id, member_id),
  FOREIGN KEY (environment, household_id, member_id)
    REFERENCES continuity_memberships(environment, household_id, member_id)
    ON DELETE CASCADE
);

ALTER TABLE continuity_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuity_personal_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS continuity_development_open ON continuity_memberships;
CREATE POLICY continuity_development_open ON continuity_memberships
  FOR ALL TO anon, authenticated
  USING (environment = 'development')
  WITH CHECK (environment = 'development');

DROP POLICY IF EXISTS continuity_personal_development_open ON continuity_personal_snapshots;
CREATE POLICY continuity_personal_development_open ON continuity_personal_snapshots
  FOR ALL TO anon, authenticated
  USING (environment = 'development')
  WITH CHECK (environment = 'development');

GRANT SELECT, INSERT, UPDATE ON continuity_memberships TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON continuity_personal_snapshots TO anon, authenticated;

COMMIT;
