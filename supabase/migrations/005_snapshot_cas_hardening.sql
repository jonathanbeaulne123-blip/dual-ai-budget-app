-- DO NOT APPLY without Jonathan's separate Development approval.
-- Forward repair for the already-applied 002_snapshot_cas.sql (D-122).
-- Production: DO NOT APPLY without a separate Production approval.
--
-- Why this is a new migration instead of an edit to 002:
--   002 is already live in Development. Applied migration history is immutable.
--
-- Repairs:
--   1. A transaction advisory lock serializes writers even before the household
--      row exists, closing the simultaneous-first-create race.
--   2. A non-duplicate write must advance beyond expected_revision.
--   3. Revision jumps remain valid because one durable outbox item may compact
--      several locally accepted offline confirmations.
--
-- Rollback: re-run the exact function body from applied migration 002. Do not
-- drop snapshot columns or rows.

BEGIN;

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
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  current_rev INTEGER;
  current_env TEXT;
  remote_payload TEXT;
  remote_hash TEXT;
BEGIN
  IF p_household_id IS NULL OR length(trim(p_household_id)) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'reason', 'invalid-household',
      'remote_revision', NULL,
      'remote_payload', NULL
    );
  END IF;
  IF p_environment NOT IN ('development', 'production') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'reason', 'environment-mismatch',
      'remote_revision', NULL,
      'remote_payload', NULL
    );
  END IF;
  IF p_expected_revision < 0 OR p_revision < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'reason', 'non-advancing-revision',
      'remote_revision', NULL,
      'remote_payload', NULL
    );
  END IF;

  -- Row locks cannot serialize a row that does not exist. This transaction lock
  -- is keyed by environment + household id and therefore covers first creation
  -- and every later write. Hash collisions only serialize unrelated writers;
  -- they cannot weaken correctness.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || chr(31) || p_household_id, 0)
  );

  SELECT revision, environment INTO current_rev, current_env
  FROM public.households
  WHERE id = p_household_id
  FOR UPDATE;

  IF FOUND THEN
    IF current_env IS DISTINCT FROM p_environment THEN
      SELECT payload INTO remote_payload
      FROM public.household_snapshots
      WHERE household_id = p_household_id;
      RETURN jsonb_build_object(
        'ok', false,
        'conflict', true,
        'reason', 'environment-mismatch',
        'remote_revision', current_rev,
        'remote_payload', remote_payload
      );
    END IF;

    -- A repeated delivery of the same accepted snapshot is success, not a new
    -- write. Same revision with different books is a visible conflict.
    IF current_rev = p_revision THEN
      SELECT payload, snapshot_hash INTO remote_payload, remote_hash
      FROM public.household_snapshots
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
      FROM public.household_snapshots
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

  -- Compacted offline work may advance by several local revisions, but a fresh
  -- write must always move beyond the remote base.
  IF p_revision <= p_expected_revision THEN
    SELECT payload INTO remote_payload
    FROM public.household_snapshots
    WHERE household_id = p_household_id;
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'reason', 'non-advancing-revision',
      'remote_revision', current_rev,
      'remote_payload', remote_payload
    );
  END IF;

  INSERT INTO public.households (
    id, name, timezone, currency, environment, invite_phrase, linked, revision, last_committed_at
  ) VALUES (
    p_household_id, p_name, p_timezone, p_currency, p_environment, p_invite_phrase,
    p_linked, p_revision, p_last_committed_at
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

  INSERT INTO public.household_snapshots (
    household_id, invite_phrase, environment, payload, updated_at, revision, snapshot_hash
  ) VALUES (
    p_household_id, p_invite_phrase, p_environment, p_payload, now()::text,
    p_revision, p_snapshot_hash
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

REVOKE ALL ON FUNCTION public.publish_household_snapshot(text, integer, text, text, text, text, text, boolean, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_household_snapshot(text, integer, text, text, text, text, text, boolean, integer, text, text, text) TO anon, authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (5, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
