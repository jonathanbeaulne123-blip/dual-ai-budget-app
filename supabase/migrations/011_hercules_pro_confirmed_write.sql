-- Migration 011 — atomic, member-consented Hercules Pro confirmed writes.
-- Review and apply to Development separately. Production remains disabled by
-- HERCULES_PRO_ALLOW_PRODUCTION until the September security cutover.
--
-- Rollback:
--   REVOKE ALL ON FUNCTION public.publish_hercules_confirmed_write(text, integer, text, text, text, text, text, boolean, integer, text, text, text, text, text, text, text, text) FROM authenticated;
--   DROP FUNCTION IF EXISTS public.publish_hercules_confirmed_write(text, integer, text, text, text, text, text, boolean, integer, text, text, text, text, text, text, text, text);

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

CREATE OR REPLACE FUNCTION public.publish_hercules_confirmed_write(
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
  p_ledger_view TEXT,
  p_member_id TEXT,
  p_personal_payload TEXT,
  p_confirmation_id TEXT,
  p_identity_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  current_rev INTEGER;
  current_env TEXT;
  remote_payload TEXT;
  remote_hash TEXT;
  current_personal_payload TEXT;
  current_personal JSONB;
  incoming_personal JSONB;
  permission_on BOOLEAN := FALSE;
BEGIN
  -- This function is intentionally Development-only even though Development
  -- and Production currently share one Supabase schema. A later reviewed
  -- security-cutover migration must explicitly replace this guard.
  IF p_environment IS DISTINCT FROM 'development' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'production-disabled');
  END IF;
  IF auth.uid() IS NULL
    OR p_member_id IS DISTINCT FROM hearth_private.own_member_id(p_household_id, p_environment)
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-member');
  END IF;
  IF p_ledger_view NOT IN ('personal', 'household')
    OR p_expected_revision < 0 OR p_revision < 0
    OR coalesce(p_confirmation_id, '') = '' OR coalesce(p_identity_hash, '') = ''
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid-write');
  END IF;
  IF NOT hearth_private.payload_is_shared(p_payload)
    OR NOT hearth_private.payload_has_confirmation(p_payload, p_confirmation_id, p_identity_hash)
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid-shared-payload');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );

  SELECT revision, environment INTO current_rev, current_env
  FROM public.households
  WHERE id = p_household_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing-base');
  END IF;
  IF current_env IS DISTINCT FROM p_environment THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'environment-mismatch');
  END IF;

  SELECT payload, snapshot_hash INTO remote_payload, remote_hash
  FROM public.household_snapshots
  WHERE household_id = p_household_id AND environment = p_environment
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing-snapshot');
  END IF;

  SELECT payload INTO current_personal_payload
  FROM public.continuity_personal_snapshots
  WHERE environment = p_environment AND household_id = p_household_id AND member_id = p_member_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'personal-snapshot-missing');
  END IF;

  BEGIN
    current_personal := current_personal_payload::jsonb;
    permission_on := CASE p_ledger_view
      WHEN 'personal' THEN coalesce((current_personal #>> '{herculesProPermissions,personalWrite}')::boolean, false)
      ELSE coalesce((current_personal #>> '{herculesProPermissions,householdWrite}')::boolean, false)
    END;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid-personal-snapshot');
  END;
  IF NOT permission_on THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'write-permission-off');
  END IF;

  IF p_ledger_view = 'household' AND p_personal_payload IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unexpected-personal-payload');
  END IF;
  IF p_ledger_view = 'personal' THEN
    IF p_personal_payload IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'missing-personal-payload');
    END IF;
    BEGIN
      incoming_personal := p_personal_payload::jsonb;
      IF incoming_personal ->> 'kind' IS DISTINCT FROM 'personal'
        OR incoming_personal ->> 'memberId' IS DISTINCT FROM p_member_id
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(coalesce(incoming_personal -> 'transactions', '[]'::jsonb)) AS item
          WHERE item ->> 'createdBy' IS DISTINCT FROM p_member_id
            OR item ->> 'visibility' IS DISTINCT FROM 'personal'
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(coalesce(incoming_personal -> 'shifts', '[]'::jsonb)) AS item
          WHERE item ->> 'createdBy' IS DISTINCT FROM p_member_id
            OR item ->> 'visibility' IS DISTINCT FROM 'personal'
        )
      THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid-personal-payload');
      END IF;
      -- A prepared write may not re-enable itself or overwrite a newer opt-out.
      incoming_personal := jsonb_set(
        incoming_personal,
        '{herculesProPermissions}',
        coalesce(current_personal -> 'herculesProPermissions', '{}'::jsonb),
        true
      );
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid-personal-payload');
    END;
  END IF;

  IF current_rev = p_revision THEN
    IF remote_hash IS DISTINCT FROM p_snapshot_hash
      OR NOT hearth_private.payload_has_confirmation(remote_payload, p_confirmation_id, p_identity_hash)
    THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'revision-hash-mismatch');
    END IF;
    IF p_ledger_view = 'personal' THEN
      UPDATE public.continuity_personal_snapshots
      SET revision = p_revision, payload = incoming_personal::text, updated_at = now()::text
      WHERE environment = p_environment AND household_id = p_household_id AND member_id = p_member_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'revision', p_revision);
  END IF;
  IF current_rev IS DISTINCT FROM p_expected_revision THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'stale-revision', 'remote_revision', current_rev);
  END IF;
  IF p_revision <= p_expected_revision THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'non-advancing-revision');
  END IF;

  UPDATE public.households SET
    name = p_name, timezone = p_timezone, currency = p_currency,
    invite_phrase = p_invite_phrase, linked = p_linked, revision = p_revision,
    last_committed_at = p_last_committed_at
  WHERE id = p_household_id AND environment = p_environment;
  UPDATE public.household_snapshots SET
    invite_phrase = p_invite_phrase, payload = p_payload, updated_at = now()::text,
    revision = p_revision, snapshot_hash = p_snapshot_hash
  WHERE household_id = p_household_id AND environment = p_environment;
  IF p_ledger_view = 'personal' THEN
    UPDATE public.continuity_personal_snapshots
    SET revision = p_revision, payload = incoming_personal::text, updated_at = now()::text
    WHERE environment = p_environment AND household_id = p_household_id AND member_id = p_member_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'revision', p_revision);
END;
$$;

REVOKE ALL ON FUNCTION hearth_private.payload_has_confirmation(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_hercules_confirmed_write(text, integer, text, text, text, text, text, boolean, integer, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_hercules_confirmed_write(text, integer, text, text, text, text, text, boolean, integer, text, text, text, text, text, text, text, text) TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (11, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
