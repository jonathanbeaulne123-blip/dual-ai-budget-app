-- Migration 013 — append-only continuity command log (D-148 T2-S1).
-- One RPC appends a bounded command event and atomically bumps Shared + Personal
-- snapshots via publish_continuity_snapshot (Migration 012) in the same transaction.
--
-- Apply Development:
--   SUPABASE_DB_PASSWORD=… pnpm books:apply:013
--   or paste into Supabase SQL Editor.
--
-- Rollback:
--   REVOKE ALL ON FUNCTION public.append_continuity_command(
--     text, text, text, text, text, text, integer, integer, text, text, jsonb,
--     text, text, text, text, text, boolean, text, text, text, text
--   ) FROM authenticated;
--   DROP FUNCTION IF EXISTS public.append_continuity_command(
--     text, text, text, text, text, text, integer, integer, text, text, jsonb,
--     text, text, text, text, text, boolean, text, text, text, text
--   );
--   DROP TABLE IF EXISTS public.continuity_command_events;
--   DELETE FROM public.schema_migrations WHERE id = 13;

BEGIN;

CREATE TABLE IF NOT EXISTS public.continuity_command_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  confirmation_id TEXT NOT NULL DEFAULT '',
  identity_hash TEXT NOT NULL DEFAULT '',
  base_revision INTEGER NOT NULL CHECK (base_revision >= 0),
  result_revision INTEGER NOT NULL CHECK (result_revision >= 0),
  ledger_scope TEXT NOT NULL CHECK (ledger_scope IN ('shared', 'personal')),
  command_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment, household_id, idempotency_key),
  FOREIGN KEY (environment, household_id, member_id)
    REFERENCES public.continuity_memberships(environment, household_id, member_id)
    ON DELETE CASCADE,
  CHECK (result_revision > base_revision)
);

CREATE INDEX IF NOT EXISTS continuity_command_events_household_order
  ON public.continuity_command_events (environment, household_id, result_revision, created_at);

CREATE INDEX IF NOT EXISTS continuity_command_events_member_scope
  ON public.continuity_command_events (environment, household_id, member_id, ledger_scope);

ALTER TABLE public.continuity_command_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hearth_command_events_select ON public.continuity_command_events;
CREATE POLICY hearth_command_events_select ON public.continuity_command_events
  FOR SELECT TO authenticated
  USING (
    (
      ledger_scope = 'shared'
      AND hearth_private.is_active_member(household_id, environment)
    )
    OR (
      ledger_scope = 'personal'
      AND member_id = hearth_private.own_member_id(household_id, environment)
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.continuity_command_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.continuity_command_events TO authenticated;

CREATE OR REPLACE FUNCTION public.append_continuity_command(
  p_household_id TEXT,
  p_environment TEXT,
  p_member_id TEXT,
  p_idempotency_key TEXT,
  p_confirmation_id TEXT,
  p_identity_hash TEXT,
  p_base_revision INTEGER,
  p_result_revision INTEGER,
  p_ledger_scope TEXT,
  p_command_type TEXT,
  p_command_payload JSONB,
  p_name TEXT,
  p_timezone TEXT,
  p_currency TEXT,
  p_invite_phrase TEXT,
  p_linked BOOLEAN,
  p_last_committed_at TEXT,
  p_shared_payload TEXT,
  p_snapshot_hash TEXT,
  p_personal_payload TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  existing public.continuity_command_events%ROWTYPE;
  snapshot_result JSONB;
  new_event_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'unauthenticated');
  END IF;
  IF p_environment IS DISTINCT FROM 'development' THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'production-disabled');
  END IF;
  IF coalesce(p_household_id, '') = ''
    OR coalesce(p_member_id, '') = ''
    OR coalesce(p_idempotency_key, '') = ''
    OR coalesce(p_command_type, '') = ''
  THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'invalid-command');
  END IF;
  IF p_ledger_scope NOT IN ('shared', 'personal') THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'invalid-ledger-scope');
  END IF;
  IF p_command_payload IS NULL OR jsonb_typeof(p_command_payload) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'invalid-command-payload');
  END IF;
  IF pg_catalog.length(p_command_payload::text) > 65536 THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'command-payload-too-large');
  END IF;
  IF p_base_revision < 0 OR p_result_revision < 0 OR p_result_revision <= p_base_revision THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'non-advancing-revision');
  END IF;
  IF NOT hearth_private.is_active_member(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'not-member');
  END IF;
  IF p_member_id IS DISTINCT FROM hearth_private.own_member_id(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'not-member');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );

  SELECT * INTO existing
  FROM public.continuity_command_events
  WHERE environment = p_environment
    AND household_id = p_household_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF existing.confirmation_id IS DISTINCT FROM coalesce(p_confirmation_id, '')
      OR existing.identity_hash IS DISTINCT FROM coalesce(p_identity_hash, '')
      OR existing.base_revision IS DISTINCT FROM p_base_revision
      OR existing.result_revision IS DISTINCT FROM p_result_revision
      OR existing.command_type IS DISTINCT FROM p_command_type
    THEN
      RETURN jsonb_build_object(
        'ok', false, 'conflict', true, 'reason', 'idempotency-key-reused',
        'result_revision', existing.result_revision, 'event_id', existing.id
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true, 'conflict', false, 'duplicate', true,
      'result_revision', existing.result_revision, 'event_id', existing.id
    );
  END IF;

  INSERT INTO public.continuity_command_events (
    environment,
    household_id,
    member_id,
    idempotency_key,
    confirmation_id,
    identity_hash,
    base_revision,
    result_revision,
    ledger_scope,
    command_type,
    payload_json
  ) VALUES (
    p_environment,
    p_household_id,
    p_member_id,
    p_idempotency_key,
    coalesce(p_confirmation_id, ''),
    coalesce(p_identity_hash, ''),
    p_base_revision,
    p_result_revision,
    p_ledger_scope,
    p_command_type,
    p_command_payload
  )
  RETURNING id INTO new_event_id;

  snapshot_result := public.publish_continuity_snapshot(
    p_household_id,
    p_base_revision,
    p_name,
    p_timezone,
    p_currency,
    p_environment,
    p_invite_phrase,
    p_linked,
    p_result_revision,
    p_last_committed_at,
    p_shared_payload,
    p_snapshot_hash,
    p_member_id,
    p_personal_payload,
    coalesce(p_confirmation_id, ''),
    coalesce(p_identity_hash, '')
  );

  IF coalesce((snapshot_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'snapshot-bump-failed: %', snapshot_result;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'conflict', false,
    'duplicate', coalesce((snapshot_result ->> 'duplicate')::boolean, false),
    'result_revision', p_result_revision,
    'event_id', new_event_id,
    'snapshot', snapshot_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.append_continuity_command(
  text, text, text, text, text, text, integer, integer, text, text, jsonb,
  text, text, text, text, text, boolean, text, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.append_continuity_command(
  text, text, text, text, text, text, integer, integer, text, text, jsonb,
  text, text, text, text, text, boolean, text, text, text, text
) TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (13, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

-- Publish command events for T2-S4 Realtime (014 already applied; add table if present).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.continuity_command_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
