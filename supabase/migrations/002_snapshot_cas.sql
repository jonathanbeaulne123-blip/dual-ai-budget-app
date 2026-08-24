-- DO NOT APPLY.
-- Trust-foundation compare-and-swap for hosted JSON snapshots.
-- Client CAS today is GET-then-compare-then-POST. A last-writer race remains
-- until Jonathan applies this RPC and the app is wired to call it.
-- Do not paste into the household Supabase SQL editor from an AI session.
-- Do not contact the household project. Order: after 001_hearth_books.sql.
-- Rollback: DROP FUNCTION IF EXISTS publish_household_snapshot(text, integer, text, text, text, text, boolean, integer, text, text, text);
--           ALTER TABLE household_snapshots DROP COLUMN IF EXISTS revision;
--           ALTER TABLE household_snapshots DROP COLUMN IF EXISTS snapshot_hash;

BEGIN;

ALTER TABLE household_snapshots
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT;

CREATE OR REPLACE FUNCTION publish_household_snapshot(
  p_household_id TEXT,
  p_expected_revision INTEGER,
  p_name TEXT,
  p_timezone TEXT,
  p_currency TEXT,
  p_environment TEXT,
  p_invite_phrase TEXT,
  p_linked BOOLEAN,
  p_revision INTEGER,
  p_last_committed_at TEXT,
  p_payload TEXT,
  p_snapshot_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  current_rev INTEGER;
  remote_payload TEXT;
BEGIN
  SELECT revision INTO current_rev
  FROM households
  WHERE id = p_household_id
  FOR UPDATE;

  IF FOUND AND current_rev IS DISTINCT FROM p_expected_revision THEN
    SELECT payload INTO remote_payload
    FROM household_snapshots
    WHERE household_id = p_household_id;
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'remote_revision', current_rev,
      'remote_payload', remote_payload
    );
  END IF;

  INSERT INTO households (
    id, name, timezone, currency, environment, invite_phrase, linked, revision, last_committed_at
  ) VALUES (
    p_household_id, p_name, p_timezone, p_currency, p_environment, p_invite_phrase, p_linked, p_revision, p_last_committed_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    timezone = EXCLUDED.timezone,
    currency = EXCLUDED.currency,
    environment = EXCLUDED.environment,
    invite_phrase = EXCLUDED.invite_phrase,
    linked = EXCLUDED.linked,
    revision = EXCLUDED.revision,
    last_committed_at = EXCLUDED.last_committed_at;

  INSERT INTO household_snapshots (
    household_id, invite_phrase, environment, payload, updated_at, revision, snapshot_hash
  ) VALUES (
    p_household_id, p_invite_phrase, p_environment, p_payload, now()::text, p_revision, p_snapshot_hash
  )
  ON CONFLICT (household_id) DO UPDATE SET
    invite_phrase = EXCLUDED.invite_phrase,
    environment = EXCLUDED.environment,
    payload = EXCLUDED.payload,
    updated_at = EXCLUDED.updated_at,
    revision = EXCLUDED.revision,
    snapshot_hash = EXCLUDED.snapshot_hash;

  RETURN jsonb_build_object('ok', true, 'conflict', false, 'revision', p_revision);
END;
$$;

REVOKE ALL ON FUNCTION publish_household_snapshot(text, integer, text, text, text, text, boolean, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_household_snapshot(text, integer, text, text, text, text, boolean, integer, text, text, text) TO anon, authenticated;

COMMIT;
