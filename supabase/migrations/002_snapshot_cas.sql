-- Development apply authorized by Jonathan 2026-08-24 (D-122).
-- Production: DO NOT APPLY without a separate Jonathan approval.
-- Trust-foundation compare-and-swap for hosted JSON snapshots (D-122).
-- Client prefers POST /rest/v1/rpc/publish_household_snapshot; falls back to
-- GET-then-compare-then-POST only when this function is missing from the API.
-- Order: after 001_hearth_books.sql; safe beside applied 003_continuity_membership.sql.
-- Apply: SUPABASE_DB_PASSWORD=… pnpm books:apply:002
--    or paste this file into https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new
-- Smoke: pnpm books:smoke:cas  (publishable key; disposable Development row)
-- Rollback: DROP FUNCTION IF EXISTS publish_household_snapshot(text, integer, text, text, text, text, boolean, integer, text, text, text);
--           ALTER TABLE household_snapshots DROP COLUMN IF EXISTS revision;
--           ALTER TABLE household_snapshots DROP COLUMN IF EXISTS snapshot_hash;
--           DELETE FROM schema_migrations WHERE id = 2;

BEGIN;

ALTER TABLE household_snapshots
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE household_snapshots
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT;

-- Align snapshot revision with the households row so pre-CAS rows do not look like rev 0.
UPDATE household_snapshots AS snap
SET revision = hh.revision
FROM households AS hh
WHERE snap.household_id = hh.id
  AND snap.revision IS DISTINCT FROM hh.revision;

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
  current_env TEXT;
  remote_payload TEXT;
  remote_hash TEXT;
BEGIN
  -- Serialize writers for this household. Client GET-then-POST races end here.
  SELECT revision, environment INTO current_rev, current_env
  FROM households
  WHERE id = p_household_id
  FOR UPDATE;

  IF FOUND THEN
    IF current_env IS DISTINCT FROM p_environment THEN
      SELECT payload INTO remote_payload
      FROM household_snapshots
      WHERE household_id = p_household_id;
      RETURN jsonb_build_object(
        'ok', false,
        'conflict', true,
        'reason', 'environment-mismatch',
        'remote_revision', current_rev,
        'remote_payload', remote_payload
      );
    END IF;

    -- Idempotent acknowledgement: duplicate delivery of an already-applied write.
    IF current_rev = p_revision THEN
      SELECT payload, snapshot_hash INTO remote_payload, remote_hash
      FROM household_snapshots
      WHERE household_id = p_household_id;
      IF remote_hash IS NOT DISTINCT FROM p_snapshot_hash THEN
        RETURN jsonb_build_object(
          'ok', true,
          'conflict', false,
          'duplicate', true,
          'revision', p_revision
        );
      END IF;
      RETURN jsonb_build_object(
        'ok', false,
        'conflict', true,
        'reason', 'revision-hash-mismatch',
        'remote_revision', current_rev,
        'remote_payload', remote_payload
      );
    END IF;

    IF current_rev IS DISTINCT FROM p_expected_revision THEN
      SELECT payload INTO remote_payload
      FROM household_snapshots
      WHERE household_id = p_household_id;
      RETURN jsonb_build_object(
        'ok', false,
        'conflict', true,
        'reason', 'stale-revision',
        'remote_revision', current_rev,
        'remote_payload', remote_payload
      );
    END IF;
  ELSIF p_expected_revision IS DISTINCT FROM 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'reason', 'missing-base',
      'remote_revision', NULL,
      'remote_payload', NULL
    );
  END IF;

  IF p_revision < p_expected_revision THEN
    SELECT payload INTO remote_payload
    FROM household_snapshots
    WHERE household_id = p_household_id;
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'reason', 'stale-revision',
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

  RETURN jsonb_build_object(
    'ok', true,
    'conflict', false,
    'duplicate', false,
    'revision', p_revision
  );
END;
$$;

-- Signature must list all 12 args (invite_phrase text is easy to drop — that 42883'd the first paste).
REVOKE ALL ON FUNCTION publish_household_snapshot(text, integer, text, text, text, text, text, boolean, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_household_snapshot(text, integer, text, text, text, text, text, boolean, integer, text, text, text) TO anon, authenticated;

INSERT INTO schema_migrations (id, applied_at)
VALUES (2, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

-- Ask PostgREST to refresh its schema cache so rpc/publish_household_snapshot appears promptly.
NOTIFY pgrst, 'reload schema';
