-- Migration 012 — atomic Shared CAS + Personal envelope (D-148 T1-S1).
-- One transaction advances household_snapshots and upserts continuity_personal_snapshots
-- so Shared cannot commit without Personal (or vice versa).
--
-- Apply Development:
--   SUPABASE_DB_PASSWORD=… pnpm books:apply:012
--   or paste into Supabase SQL Editor.
--
-- Rollback:
--   REVOKE ALL ON FUNCTION public.publish_continuity_snapshot(
--     text, integer, text, text, text, text, text, boolean, integer, text, text, text,
--     text, text, text, text
--   ) FROM authenticated;
--   DROP FUNCTION IF EXISTS public.publish_continuity_snapshot(
--     text, integer, text, text, text, text, text, boolean, integer, text, text, text,
--     text, text, text, text
--   );
--   DELETE FROM public.schema_migrations WHERE id = 12;

BEGIN;

CREATE OR REPLACE FUNCTION hearth_private.payload_has_confirmation(
  p_payload TEXT,
  p_confirmation_id TEXT,
  p_identity_hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE payload JSONB;
BEGIN
  IF coalesce(p_confirmation_id, '') = '' OR coalesce(p_identity_hash, '') = '' THEN
    RETURN FALSE;
  END IF;
  payload := p_payload::jsonb;
  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(payload -> 'commandReceipts', '[]'::jsonb)) AS receipt
    WHERE receipt ->> 'confirmationId' = p_confirmation_id
      AND receipt ->> 'identityHash' = p_identity_hash
  );
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION hearth_private.payload_is_member_personal(
  p_payload TEXT,
  p_member_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE payload JSONB;
BEGIN
  IF coalesce(p_member_id, '') = '' THEN
    RETURN FALSE;
  END IF;
  payload := p_payload::jsonb;
  IF payload ->> 'kind' IS DISTINCT FROM 'personal' THEN
    RETURN FALSE;
  END IF;
  IF payload ->> 'memberId' IS DISTINCT FROM p_member_id THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'transactions', '[]'::jsonb)) AS item
    WHERE item ->> 'createdBy' IS DISTINCT FROM p_member_id
      OR item ->> 'visibility' IS DISTINCT FROM 'personal'
  ) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'shifts', '[]'::jsonb)) AS item
    WHERE item ->> 'createdBy' IS DISTINCT FROM p_member_id
      OR item ->> 'visibility' IS DISTINCT FROM 'personal'
  ) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'goals', '[]'::jsonb)) AS item
    WHERE coalesce((item ->> 'shared')::boolean, true) IS TRUE
      OR item ->> 'ownerMemberId' IS DISTINCT FROM p_member_id
  ) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'goalContributions', '[]'::jsonb)) AS item
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'goals', '[]'::jsonb)) AS goal
      WHERE goal ->> 'id' = item ->> 'goalId'
    )
  ) THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'goalPurchases', '[]'::jsonb)) AS item
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'goals', '[]'::jsonb)) AS goal
      WHERE goal ->> 'id' = item ->> 'goalId'
    )
  ) THEN
    RETURN FALSE;
  END IF;
  IF jsonb_array_length(coalesce(payload -> 'commandReceipts', '[]'::jsonb)) > 0 THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_continuity_snapshot(
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
  p_snapshot_hash TEXT,
  p_member_id TEXT,
  p_personal_payload TEXT,
  p_confirmation_id TEXT DEFAULT '',
  p_identity_hash TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  current_rev INTEGER;
  current_env TEXT;
  remote_payload TEXT;
  remote_hash TEXT;
  current_personal_payload TEXT;
  has_confirmation BOOLEAN := coalesce(p_confirmation_id, '') <> '' AND coalesce(p_identity_hash, '') <> '';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'unauthenticated');
  END IF;
  IF p_environment IS DISTINCT FROM 'development' THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'production-disabled');
  END IF;
  IF p_household_id IS NULL OR length(trim(p_household_id)) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'invalid-household',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;
  IF p_environment NOT IN ('development', 'production') THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'environment-mismatch',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;
  IF p_expected_revision < 0 OR p_revision < 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'non-advancing-revision',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;
  IF NOT hearth_private.is_active_member(p_household_id, p_environment) THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'not-member',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;
  IF p_member_id IS DISTINCT FROM hearth_private.own_member_id(p_household_id, p_environment) THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'not-member',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;
  IF NOT hearth_private.payload_is_shared(p_payload) THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'personal-data-in-shared-payload',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;
  IF p_personal_payload IS NULL
    OR NOT hearth_private.payload_is_member_personal(p_personal_payload, p_member_id)
  THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'invalid-personal-payload',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;
  IF has_confirmation
    AND NOT hearth_private.payload_has_confirmation(p_payload, p_confirmation_id, p_identity_hash)
  THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'missing-confirmation-receipt',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );

  SELECT revision, environment INTO current_rev, current_env
  FROM public.households
  WHERE id = p_household_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'missing-base',
      'remote_revision', NULL, 'remote_payload', NULL
    );
  END IF;

  SELECT payload, snapshot_hash INTO remote_payload, remote_hash
  FROM public.household_snapshots
  WHERE household_id = p_household_id AND environment = p_environment
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'missing-snapshot',
      'remote_revision', current_rev, 'remote_payload', NULL
    );
  END IF;

  IF current_env IS DISTINCT FROM p_environment THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'environment-mismatch',
      'remote_revision', current_rev, 'remote_payload', remote_payload
    );
  END IF;

  IF current_rev = p_revision THEN
    IF remote_hash IS DISTINCT FROM p_snapshot_hash THEN
      RETURN jsonb_build_object(
        'ok', false, 'conflict', true, 'reason', 'revision-hash-mismatch',
        'remote_revision', current_rev, 'remote_payload', remote_payload
      );
    END IF;
    IF has_confirmation
      AND NOT hearth_private.payload_has_confirmation(remote_payload, p_confirmation_id, p_identity_hash)
    THEN
      RETURN jsonb_build_object(
        'ok', false, 'conflict', true, 'reason', 'revision-hash-mismatch',
        'remote_revision', current_rev, 'remote_payload', remote_payload
      );
    END IF;
    SELECT payload INTO current_personal_payload
    FROM public.continuity_personal_snapshots
    WHERE environment = p_environment
      AND household_id = p_household_id
      AND member_id = p_member_id
    FOR UPDATE;
    IF FOUND AND current_personal_payload IS DISTINCT FROM p_personal_payload THEN
      RETURN jsonb_build_object(
        'ok', false, 'conflict', true, 'reason', 'personal-payload-mismatch',
        'remote_revision', current_rev, 'remote_payload', remote_payload
      );
    END IF;
    IF NOT FOUND THEN
      INSERT INTO public.continuity_personal_snapshots (
        environment, household_id, member_id, revision, payload, updated_at
      ) VALUES (
        p_environment, p_household_id, p_member_id, p_revision, p_personal_payload, now()::text
      );
    END IF;
    UPDATE public.continuity_memberships
    SET updated_at = now()::text
    WHERE environment = p_environment
      AND household_id = p_household_id
      AND member_id = p_member_id;
    RETURN jsonb_build_object(
      'ok', true, 'conflict', false, 'duplicate', true, 'revision', p_revision
    );
  END IF;

  IF current_rev IS DISTINCT FROM p_expected_revision THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'stale-revision',
      'remote_revision', current_rev, 'remote_payload', remote_payload
    );
  END IF;

  IF p_revision <= p_expected_revision THEN
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'non-advancing-revision',
      'remote_revision', current_rev, 'remote_payload', remote_payload
    );
  END IF;

  UPDATE public.households SET
    name = p_name,
    timezone = p_timezone,
    currency = p_currency,
    invite_phrase = p_invite_phrase,
    linked = p_linked,
    revision = p_revision,
    last_committed_at = p_last_committed_at
  WHERE id = p_household_id AND environment = p_environment;

  UPDATE public.household_snapshots SET
    invite_phrase = p_invite_phrase,
    payload = p_payload,
    updated_at = now()::text,
    revision = p_revision,
    snapshot_hash = p_snapshot_hash
  WHERE household_id = p_household_id AND environment = p_environment;

  INSERT INTO public.continuity_personal_snapshots (
    environment, household_id, member_id, revision, payload, updated_at
  ) VALUES (
    p_environment, p_household_id, p_member_id, p_revision, p_personal_payload, now()::text
  )
  ON CONFLICT (environment, household_id, member_id) DO UPDATE SET
    revision = EXCLUDED.revision,
    payload = EXCLUDED.payload,
    updated_at = EXCLUDED.updated_at;

  UPDATE public.continuity_memberships
  SET updated_at = now()::text
  WHERE environment = p_environment
    AND household_id = p_household_id
    AND member_id = p_member_id;

  RETURN jsonb_build_object(
    'ok', true, 'conflict', false, 'duplicate', false, 'revision', p_revision
  );
END;
$$;

REVOKE ALL ON FUNCTION hearth_private.payload_has_confirmation(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION hearth_private.payload_is_member_personal(text, text) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.publish_continuity_snapshot(
  text, integer, text, text, text, text, text, boolean, integer, text, text, text,
  text, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.publish_continuity_snapshot(
  text, integer, text, text, text, text, text, boolean, integer, text, text, text,
  text, text, text, text
) TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (12, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
