-- 009_rollback_006.sql
-- Emergency rollback after 006_auth_rls_cutover. Rehearse on a disposable clone
-- before any live use.
-- Restores the pre-006 open Development bridge for books tables, 003 Development
-- continuity policies, and 008 Production SELECT. Restores the 005 CAS publish
-- function body (SECURITY INVOKER). Does NOT drop schema_migrations 2/4/5/7/8.
-- Does NOT delete household data. Does NOT open household_invitations (004 deny-all).
-- Does NOT drop 004 hearth_claim_legacy_owner.
--
-- DO NOT RUN on the live project unless Jonathan explicitly orders rollback.

BEGIN;

-- Drop cutover RPCs introduced by 006 only (keep 004 claim + 005 publish name).
DROP FUNCTION IF EXISTS public.hearth_create_household(text, text, text, text, text, text, boolean, integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.hearth_issue_invite(text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.hearth_redeem_invite(text, text);
DROP FUNCTION IF EXISTS public.hearth_revoke_member(text, text, text);

DROP SCHEMA IF EXISTS hearth_private CASCADE;

DO $$
DECLARE table_name TEXT; policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'households', 'household_snapshots', 'continuity_memberships',
    'continuity_personal_snapshots', 'household_invitations', 'members',
    'categories', 'chart_accounts', 'journal_entries', 'journal_lines',
    'source_transactions', 'shifts', 'goals', 'budget_plans', 'recurrences',
    'activity', 'audit_revisions'
  ]
  LOOP
    FOR policy_name IN
      SELECT policyname FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    END LOOP;
  END LOOP;
END $$;

-- Restore 001-style open policies on books tables only (not invitations).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'households', 'household_snapshots', 'members',
    'categories', 'chart_accounts', 'journal_entries', 'journal_lines',
    'source_transactions', 'shifts', 'goals', 'budget_plans', 'recurrences',
    'activity', 'audit_revisions'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY hearth_anon_all ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;

-- household_invitations stays RLS-enabled with no policy = deny-all (004 baseline).

CREATE POLICY continuity_development_open ON public.continuity_memberships
  FOR ALL TO anon, authenticated
  USING (environment = 'development')
  WITH CHECK (environment = 'development');

CREATE POLICY continuity_personal_development_open ON public.continuity_personal_snapshots
  FOR ALL TO anon, authenticated
  USING (environment = 'development')
  WITH CHECK (environment = 'development');

CREATE POLICY continuity_production_select ON public.continuity_memberships
  FOR SELECT TO anon, authenticated
  USING (environment = 'production');

CREATE POLICY continuity_personal_production_select ON public.continuity_personal_snapshots
  FOR SELECT TO anon, authenticated
  USING (environment = 'production');

REVOKE ALL PRIVILEGES ON TABLE
  public.households, public.household_snapshots, public.continuity_memberships,
  public.continuity_personal_snapshots, public.household_invitations,
  public.members, public.categories, public.chart_accounts, public.journal_entries,
  public.journal_lines, public.source_transactions, public.shifts, public.goals,
  public.budget_plans, public.recurrences, public.activity, public.audit_revisions
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.households, public.household_snapshots,
  public.members, public.categories, public.chart_accounts, public.journal_entries,
  public.journal_lines, public.source_transactions, public.shifts, public.goals,
  public.budget_plans, public.recurrences, public.activity, public.audit_revisions
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.continuity_memberships TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.continuity_personal_snapshots TO anon, authenticated;
-- invitations: no grants restored (004 deny-all)

-- Keep 001 security_invoker = true (do not set false).
ALTER VIEW public.v_unbalanced_entries SET (security_invoker = true);
ALTER VIEW public.v_journal SET (security_invoker = true);
ALTER VIEW public.v_trial_balance SET (security_invoker = true);
ALTER VIEW public.v_income_statement SET (security_invoker = true);
ALTER VIEW public.v_net_worth SET (security_invoker = true);
ALTER VIEW public.v_catalog SET (security_invoker = true);

GRANT SELECT ON
  public.v_unbalanced_entries, public.v_journal, public.v_trial_balance,
  public.v_income_statement, public.v_net_worth, public.v_catalog
TO anon, authenticated;

-- Restore 005 SECURITY INVOKER publish body (006 had replaced it).

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


DELETE FROM public.schema_migrations WHERE id = 6;

COMMIT;

NOTIFY pgrst, 'reload schema';
