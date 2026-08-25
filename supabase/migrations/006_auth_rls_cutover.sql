-- DO NOT APPLY without Jonathan's explicit Development cutover approval.
-- Deny-by-default Auth + membership RLS cutover (D-123).
-- Production: DO NOT APPLY without a separate Production approval.
--
-- Required order:
--   002 (already live) -> 004_auth_rls_prepare -> 005_snapshot_cas_hardening
--   -> 006_auth_rls_cutover
--
-- 006 aborts before changing policies unless every active membership is bound
-- to auth.users, each represented household has exactly one active owner, and
-- shared snapshots contain no Personal transactions, shifts, or goals.
-- The policies and grants below are project-wide, not environment-scoped. The
-- preflight therefore also refuses to run while any Production household is in
-- this shared Supabase project. Move Production to an independently approved
-- project, or obtain explicit full-project cutover approval and revise this
-- guard in a reviewed follow-up migration; do not mistake 006 for a
-- Development-only switch.
-- A failed preflight leaves the disposable-Development policies intact.

BEGIN;

DO $$
DECLARE
  unbound_count BIGINT;
  bad_owner_count BIGINT;
  personal_payload_count BIGINT;
  production_household_count BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE id = 4) THEN
    RAISE EXCEPTION 'Auth preparation 004 has not been applied.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE id = 5) THEN
    RAISE EXCEPTION 'CAS hardening 005 has not been applied.';
  END IF;

  SELECT count(*) INTO production_household_count
  FROM public.households
  WHERE environment = 'production';
  IF production_household_count > 0 THEN
    RAISE EXCEPTION 'Auth cutover blocked: 006 changes project-wide policies and grants, but % Production households remain. Development-only cutover requires a separate project; Production needs explicit approval.', production_household_count;
  END IF;

  SELECT count(*) INTO unbound_count
  FROM public.continuity_memberships
  WHERE active IS TRUE AND revoked_at IS NULL AND auth_user_id IS NULL;
  IF unbound_count > 0 THEN
    RAISE EXCEPTION 'Auth cutover blocked: % active memberships are not bound to auth.users.', unbound_count;
  END IF;

  SELECT count(*) INTO bad_owner_count
  FROM (
    SELECT household.environment, household.id AS household_id
    FROM public.households AS household
    LEFT JOIN public.continuity_memberships AS membership
      ON membership.environment = household.environment
      AND membership.household_id = household.id
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL
    GROUP BY household.environment, household.id
    HAVING count(membership.member_id) FILTER (WHERE membership.role = 'owner') <> 1
  ) AS invalid_households;
  IF bad_owner_count > 0 THEN
    RAISE EXCEPTION 'Auth cutover blocked: % households do not have exactly one active owner.', bad_owner_count;
  END IF;

  SELECT count(*) INTO personal_payload_count
  FROM public.household_snapshots AS snapshot
  WHERE (
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'transactions', '[]'::jsonb)) AS item
      WHERE item ->> 'visibility' = 'personal'
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'shifts', '[]'::jsonb)) AS item
      WHERE item ->> 'visibility' = 'personal'
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'goals', '[]'::jsonb)) AS item
      WHERE coalesce((item ->> 'shared')::boolean, true) IS FALSE
    )
  );
  IF personal_payload_count > 0 THEN
    RAISE EXCEPTION 'Auth cutover blocked: % shared snapshots still contain Personal ledger rows.', personal_payload_count;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS hearth_private;
REVOKE ALL ON SCHEMA hearth_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA hearth_private TO authenticated;

-- SECURITY DEFINER helpers avoid recursive RLS on continuity_memberships. They
-- are outside the exposed public schema, have an empty search_path, fully
-- qualify every relation, and are executable only by authenticated callers.
CREATE OR REPLACE FUNCTION hearth_private.is_active_member(
  p_household_id TEXT,
  p_environment TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.continuity_memberships AS membership
    WHERE membership.household_id = p_household_id
      AND membership.environment = p_environment
      AND membership.auth_user_id = auth.uid()
      AND membership.active IS TRUE AND membership.revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION hearth_private.is_household_owner(
  p_household_id TEXT,
  p_environment TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.continuity_memberships AS membership
    WHERE membership.household_id = p_household_id
      AND membership.environment = p_environment
      AND membership.auth_user_id = auth.uid()
      AND membership.role = 'owner'
      AND membership.active IS TRUE AND membership.revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION hearth_private.own_member_id(
  p_household_id TEXT,
  p_environment TEXT
) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT membership.member_id
  FROM public.continuity_memberships AS membership
  WHERE membership.household_id = p_household_id
    AND membership.environment = p_environment
    AND membership.auth_user_id = auth.uid()
    AND membership.active IS TRUE AND membership.revoked_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION hearth_private.jwt_email()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION hearth_private.payload_is_shared(p_payload TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE payload JSONB;
BEGIN
  payload := p_payload::jsonb;
  RETURN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'transactions', '[]'::jsonb)) AS item
    WHERE item ->> 'visibility' = 'personal'
  )
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'shifts', '[]'::jsonb)) AS item
    WHERE item ->> 'visibility' = 'personal'
  )
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'goals', '[]'::jsonb)) AS item
    WHERE coalesce((item ->> 'shared')::boolean, true) IS FALSE
  );
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hearth_private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hearth_private TO authenticated;

-- Remove every prior policy by discovery, not only the names this repository
-- happens to know. That closes leftover USING(true) doors.
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY hearth_households_select ON public.households
  FOR SELECT TO authenticated
  USING (hearth_private.is_active_member(id, environment));
CREATE POLICY hearth_snapshots_select ON public.household_snapshots
  FOR SELECT TO authenticated
  USING (hearth_private.is_active_member(household_id, environment));
CREATE POLICY hearth_memberships_select ON public.continuity_memberships
  FOR SELECT TO authenticated
  USING (hearth_private.is_active_member(household_id, environment));

CREATE POLICY hearth_personal_select ON public.continuity_personal_snapshots
  FOR SELECT TO authenticated
  USING (member_id = hearth_private.own_member_id(household_id, environment));
CREATE POLICY hearth_personal_insert ON public.continuity_personal_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (member_id = hearth_private.own_member_id(household_id, environment));
CREATE POLICY hearth_personal_update ON public.continuity_personal_snapshots
  FOR UPDATE TO authenticated
  USING (member_id = hearth_private.own_member_id(household_id, environment))
  WITH CHECK (member_id = hearth_private.own_member_id(household_id, environment));

CREATE POLICY hearth_invites_select ON public.household_invitations
  FOR SELECT TO authenticated
  USING (
    hearth_private.is_household_owner(household_id, environment)
    OR (kind = 'email' AND lower(invited_email) = hearth_private.jwt_email())
  );

-- Normalized journal tables are read-only projections for authenticated active
-- members. Client writes continue through the validated snapshot/CAS boundary.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'members', 'categories', 'chart_accounts', 'journal_entries', 'journal_lines',
    'source_transactions', 'shifts', 'goals', 'budget_plans', 'recurrences',
    'activity', 'audit_revisions'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY hearth_%1$s_select ON public.%1$I FOR SELECT TO authenticated USING (hearth_private.is_active_member(%1$I.household_id, (SELECT h.environment FROM public.households AS h WHERE h.id = %1$I.household_id)))',
      table_name
    );
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON TABLE
  public.households, public.household_snapshots, public.continuity_memberships,
  public.continuity_personal_snapshots, public.household_invitations,
  public.members, public.categories, public.chart_accounts, public.journal_entries,
  public.journal_lines, public.source_transactions, public.shifts, public.goals,
  public.budget_plans, public.recurrences, public.activity, public.audit_revisions
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.households, public.household_snapshots, public.continuity_memberships,
  public.household_invitations, public.members, public.categories,
  public.chart_accounts, public.journal_entries, public.journal_lines,
  public.source_transactions, public.shifts, public.goals, public.budget_plans,
  public.recurrences, public.activity, public.audit_revisions
TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.continuity_personal_snapshots TO authenticated;

REVOKE ALL ON
  public.v_unbalanced_entries, public.v_journal, public.v_trial_balance,
  public.v_income_statement, public.v_net_worth, public.v_catalog
FROM anon;
ALTER VIEW public.v_unbalanced_entries SET (security_invoker = true);
ALTER VIEW public.v_journal SET (security_invoker = true);
ALTER VIEW public.v_trial_balance SET (security_invoker = true);
ALTER VIEW public.v_income_statement SET (security_invoker = true);
ALTER VIEW public.v_net_worth SET (security_invoker = true);
ALTER VIEW public.v_catalog SET (security_invoker = true);
GRANT SELECT ON
  public.v_unbalanced_entries, public.v_journal, public.v_trial_balance,
  public.v_income_statement, public.v_net_worth, public.v_catalog
TO authenticated;

-- New household creation and first-owner assignment are one transaction. This
-- is the only owner-creation path after cutover.
CREATE OR REPLACE FUNCTION public.hearth_create_household(
  p_household_id TEXT, p_name TEXT, p_timezone TEXT, p_currency TEXT,
  p_environment TEXT, p_invite_phrase TEXT, p_linked BOOLEAN,
  p_revision INTEGER, p_last_committed_at TEXT, p_payload TEXT,
  p_snapshot_hash TEXT, p_member_id TEXT, p_display_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  payload JSONB;
  resolved_google_subject TEXT;
  resolved_google_email TEXT;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'unauthenticated');
  END IF;
  IF p_environment NOT IN ('development', 'production') OR p_revision <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'invalid-create');
  END IF;
  IF NOT hearth_private.payload_is_shared(p_payload) THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'personal-data-in-shared-payload');
  END IF;
  payload := p_payload::jsonb;
  IF payload ->> 'householdId' IS DISTINCT FROM p_household_id
    OR lower(payload ->> 'environment') IS DISTINCT FROM p_environment
    OR (payload ->> 'revision')::integer IS DISTINCT FROM p_revision
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(payload -> 'members', '[]'::jsonb)) AS member
      WHERE member ->> 'id' = p_member_id AND coalesce((member ->> 'active')::boolean, true)
    )
  THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'payload-identity-mismatch');
  END IF;

  SELECT identity.provider_id,
         lower(coalesce(identity.identity_data ->> 'email', hearth_private.jwt_email()))
  INTO resolved_google_subject, resolved_google_email
  FROM auth.identities AS identity
  WHERE identity.user_id = caller AND identity.provider = 'google'
  LIMIT 1;
  IF resolved_google_subject IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'google-identity-required');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );
  IF EXISTS (SELECT 1 FROM public.households WHERE id = p_household_id) THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'household-already-exists');
  END IF;

  INSERT INTO public.households (
    id, name, timezone, currency, environment, invite_phrase, linked, revision, last_committed_at
  ) VALUES (
    p_household_id, p_name, p_timezone, p_currency, p_environment, p_invite_phrase,
    p_linked, p_revision, p_last_committed_at
  );
  INSERT INTO public.household_snapshots (
    household_id, invite_phrase, environment, payload, updated_at, revision, snapshot_hash
  ) VALUES (
    p_household_id, p_invite_phrase, p_environment, p_payload, now()::text,
    p_revision, p_snapshot_hash
  );
  INSERT INTO public.continuity_memberships (
    environment, household_id, member_id, google_subject, google_email,
    display_name, active, updated_at, auth_user_id, role, revoked_at
  ) VALUES (
    p_environment, p_household_id, p_member_id, resolved_google_subject,
    resolved_google_email, coalesce(p_display_name, ''), true, now()::text,
    caller, 'owner', NULL
  );

  RETURN jsonb_build_object('ok', true, 'conflict', false, 'duplicate', false, 'revision', p_revision);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'invalid-payload');
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_issue_invite(
  p_environment TEXT, p_household_id TEXT, p_member_id TEXT, p_kind TEXT,
  p_invited_email TEXT DEFAULT NULL, p_ttl_hours INTEGER DEFAULT 168
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  raw_token TEXT;
  token_hash TEXT;
  invite_id UUID;
  expires TIMESTAMPTZ;
  member_name TEXT;
  membership_user UUID;
  membership_role TEXT;
BEGIN
  IF NOT hearth_private.is_household_owner(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  IF p_kind NOT IN ('email', 'qr') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-kind');
  END IF;
  IF p_kind = 'email' AND nullif(lower(trim(p_invited_email)), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-required');
  END IF;

  SELECT member ->> 'name' INTO member_name
  FROM public.household_snapshots AS snapshot,
       jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'members', '[]'::jsonb)) AS member
  WHERE snapshot.household_id = p_household_id
    AND snapshot.environment = p_environment
    AND member ->> 'id' = p_member_id
    AND coalesce((member ->> 'active')::boolean, true)
  LIMIT 1;
  IF member_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'member-not-in-household');
  END IF;

  INSERT INTO public.continuity_memberships (
    environment, household_id, member_id, google_subject, google_email,
    display_name, active, updated_at, auth_user_id, role, revoked_at
  ) VALUES (
    p_environment, p_household_id, p_member_id, '',
    CASE WHEN p_kind = 'email' THEN lower(trim(p_invited_email)) ELSE '' END,
    member_name, true, now()::text, NULL, 'member', NULL
  ) ON CONFLICT (environment, household_id, member_id) DO NOTHING;

  SELECT auth_user_id, role INTO membership_user, membership_role
  FROM public.continuity_memberships
  WHERE environment = p_environment AND household_id = p_household_id AND member_id = p_member_id
  FOR UPDATE;
  IF membership_role = 'owner' OR membership_user IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'member-already-bound');
  END IF;

  raw_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  token_hash := encode(sha256(convert_to(raw_token, 'UTF8')), 'hex');
  expires := now() + make_interval(hours => greatest(1, least(p_ttl_hours, 720)));
  INSERT INTO public.household_invitations (
    environment, household_id, target_member_id, kind, invite_token_hash,
    invited_email, created_by_auth_user_id, status, expires_at
  ) VALUES (
    p_environment, p_household_id, p_member_id, p_kind, token_hash,
    CASE WHEN p_kind = 'email' THEN lower(trim(p_invited_email)) ELSE NULL END,
    auth.uid(), 'pending', expires
  ) RETURNING id INTO invite_id;

  RETURN jsonb_build_object(
    'ok', true, 'id', invite_id, 'kind', p_kind, 'invite_token', raw_token,
    'expires_at', expires,
    'join_path', '/join?invite=' || raw_token || '&env=' || p_environment
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_redeem_invite(
  p_invite_token TEXT,
  p_display_name TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  invite public.household_invitations%ROWTYPE;
  resolved_google_subject TEXT;
  resolved_google_email TEXT;
  target_user UUID;
  target_role TEXT;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  SELECT identity.provider_id,
         lower(coalesce(identity.identity_data ->> 'email', hearth_private.jwt_email()))
  INTO resolved_google_subject, resolved_google_email
  FROM auth.identities AS identity
  WHERE identity.user_id = caller AND identity.provider = 'google'
  LIMIT 1;
  IF resolved_google_subject IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'google-identity-required');
  END IF;

  SELECT * INTO invite
  FROM public.household_invitations
  WHERE invite_token_hash = encode(sha256(convert_to(p_invite_token, 'UTF8')), 'hex')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found');
  END IF;
  IF invite.status = 'accepted' AND invite.accepted_by_auth_user_id = caller THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'role', 'member',
      'household_id', invite.household_id, 'environment', invite.environment
    );
  END IF;
  IF invite.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-pending');
  END IF;
  IF invite.expires_at <= now() THEN
    UPDATE public.household_invitations SET status = 'expired' WHERE id = invite.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF invite.kind = 'email' AND lower(invite.invited_email) IS DISTINCT FROM resolved_google_email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-mismatch');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.continuity_memberships
    WHERE environment = invite.environment AND household_id = invite.household_id
      AND auth_user_id = caller AND active IS TRUE AND revoked_at IS NULL
      AND member_id IS DISTINCT FROM invite.target_member_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already-member');
  END IF;

  SELECT auth_user_id, role INTO target_user, target_role
  FROM public.continuity_memberships
  WHERE environment = invite.environment AND household_id = invite.household_id
    AND member_id = invite.target_member_id
  FOR UPDATE;
  IF target_role = 'owner' OR (target_user IS NOT NULL AND target_user IS DISTINCT FROM caller) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target-unavailable');
  END IF;

  UPDATE public.continuity_memberships
  SET auth_user_id = caller, google_subject = resolved_google_subject,
      google_email = resolved_google_email,
      display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
      role = 'member', active = true, revoked_at = NULL, updated_at = now()::text
  WHERE environment = invite.environment AND household_id = invite.household_id
    AND member_id = invite.target_member_id;
  UPDATE public.household_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by_auth_user_id = caller
  WHERE id = invite.id;

  RETURN jsonb_build_object(
    'ok', true, 'duplicate', false, 'role', 'member',
    'member_id', invite.target_member_id,
    'household_id', invite.household_id, 'environment', invite.environment
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_revoke_member(
  p_environment TEXT, p_household_id TEXT, p_member_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT hearth_private.is_household_owner(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  UPDATE public.continuity_memberships
  SET active = false, revoked_at = now(), updated_at = now()::text
  WHERE environment = p_environment AND household_id = p_household_id
    AND member_id = p_member_id AND role = 'member'
    AND auth_user_id IS DISTINCT FROM auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found-owner-or-self');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Authenticated multi-table CAS. First creation uses hearth_create_household.
CREATE OR REPLACE FUNCTION public.publish_household_snapshot(
  p_household_id TEXT, p_expected_revision INTEGER, p_name TEXT,
  p_timezone TEXT, p_currency TEXT, p_environment TEXT, p_invite_phrase TEXT,
  p_linked BOOLEAN, p_revision INTEGER, p_last_committed_at TEXT,
  p_payload TEXT, p_snapshot_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  current_rev INTEGER;
  current_env TEXT;
  remote_payload TEXT;
  remote_hash TEXT;
BEGIN
  IF NOT hearth_private.is_active_member(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'not-member');
  END IF;
  IF NOT hearth_private.payload_is_shared(p_payload) THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'personal-data-in-shared-payload');
  END IF;
  IF p_expected_revision < 0 OR p_revision < 0 THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'non-advancing-revision');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );
  SELECT revision, environment INTO current_rev, current_env
  FROM public.households WHERE id = p_household_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'reason', 'missing-base');
  END IF;
  SELECT payload, snapshot_hash INTO remote_payload, remote_hash
  FROM public.household_snapshots WHERE household_id = p_household_id;
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
    IF remote_hash IS NOT DISTINCT FROM p_snapshot_hash THEN
      RETURN jsonb_build_object('ok', true, 'conflict', false, 'duplicate', true, 'revision', p_revision);
    END IF;
    RETURN jsonb_build_object(
      'ok', false, 'conflict', true, 'reason', 'revision-hash-mismatch',
      'remote_revision', current_rev, 'remote_payload', remote_payload
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
    name = p_name, timezone = p_timezone, currency = p_currency,
    invite_phrase = p_invite_phrase, linked = p_linked, revision = p_revision,
    last_committed_at = p_last_committed_at
  WHERE id = p_household_id AND environment = p_environment;
  UPDATE public.household_snapshots SET
    invite_phrase = p_invite_phrase, payload = p_payload, updated_at = now()::text,
    revision = p_revision, snapshot_hash = p_snapshot_hash
  WHERE household_id = p_household_id AND environment = p_environment;
  RETURN jsonb_build_object('ok', true, 'conflict', false, 'duplicate', false, 'revision', p_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.hearth_create_household(text, text, text, text, text, text, boolean, integer, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_issue_invite(text, text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_redeem_invite(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_revoke_member(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_claim_legacy_owner(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_household_snapshot(text, integer, text, text, text, text, text, boolean, integer, text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.hearth_create_household(text, text, text, text, text, text, boolean, integer, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_issue_invite(text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_redeem_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_revoke_member(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_claim_legacy_owner(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_household_snapshot(text, integer, text, text, text, text, text, boolean, integer, text, text, text) TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (6, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
