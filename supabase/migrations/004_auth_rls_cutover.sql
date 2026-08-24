-- DO NOT APPLY without Jonathan's explicit approval after review.
-- Auth + membership RLS cutover (D-123).
-- Product locks (Jonathan 2026-08-24):
--   Q1 A — Supabase Auth Google provider → auth.uid()
--   Q2 — owner/member; Create → owner; Join → member; owners invite/revoke
--   Q3 — email invite OR QR invite (not phrase-as-Auth-door)
--   Q4 — no household REST for anon
--   Q5 — apply to Development once this packet is reviewed; Production separate
--
-- Do not paste into the household SQL editor from an AI session.
-- Do not contact the household project. Do not mix into GPT's 002 CAS apply.
-- Order: after 001 + 003; preferably after 002 CAS is live.
-- Rollback sketch: restore prior policies only under Jonathan's recovery plan.
--
-- Synthetic proof: src/ledger/authRlsPolicy.ts + test/auth-rls-policy.test.ts
--   (no household project). Live pgTAP matrix is a follow-up once a disposable
--   Supabase project exists for rehearsal.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Membership columns on the live continuity bridge (D-117)
-- ---------------------------------------------------------------------------
ALTER TABLE continuity_memberships
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE continuity_memberships
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE continuity_memberships
  DROP CONSTRAINT IF EXISTS continuity_memberships_role_check;
ALTER TABLE continuity_memberships
  ADD CONSTRAINT continuity_memberships_role_check
  CHECK (role IN ('owner', 'member'));
ALTER TABLE continuity_memberships
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS continuity_membership_auth_user
  ON continuity_memberships (environment, household_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL AND active AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS continuity_membership_auth_lookup
  ON continuity_memberships (auth_user_id, environment)
  WHERE auth_user_id IS NOT NULL AND active AND revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Invitations: email or QR (owners only issue / revoke)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email', 'qr')),
  invite_token TEXT NOT NULL UNIQUE,
  invited_email TEXT,
  created_by_auth_user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_auth_user_id UUID,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT household_invitations_email_kind CHECK (
    (kind = 'email' AND invited_email IS NOT NULL AND length(trim(invited_email)) > 0)
    OR (kind = 'qr' AND invited_email IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS household_invitations_household
  ON household_invitations (environment, household_id, status);
CREATE INDEX IF NOT EXISTS household_invitations_email
  ON household_invitations (environment, lower(invited_email))
  WHERE kind = 'email' AND invited_email IS NOT NULL;

ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Helper predicates (SECURITY INVOKER — never DEFINER bypass)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hearth_is_active_member(p_household_id TEXT, p_environment TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM continuity_memberships m
    WHERE m.household_id = p_household_id
      AND m.environment = p_environment
      AND m.auth_user_id = auth.uid()
      AND m.active IS TRUE
      AND m.revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION hearth_is_household_owner(p_household_id TEXT, p_environment TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM continuity_memberships m
    WHERE m.household_id = p_household_id
      AND m.environment = p_environment
      AND m.auth_user_id = auth.uid()
      AND m.role = 'owner'
      AND m.active IS TRUE
      AND m.revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION hearth_jwt_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

REVOKE ALL ON FUNCTION hearth_is_active_member(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_is_household_owner(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_jwt_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hearth_is_active_member(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_is_household_owner(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_jwt_email() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Drop open doors; deny-by-default membership policies
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'households',
    'household_snapshots',
    'members',
    'categories',
    'chart_accounts',
    'journal_entries',
    'journal_lines',
    'source_transactions',
    'shifts',
    'goals',
    'budget_plans',
    'recurrences',
    'activity',
    'audit_revisions'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS hearth_anon_all ON %I', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS continuity_development_open ON continuity_memberships;
DROP POLICY IF EXISTS continuity_personal_development_open ON continuity_personal_snapshots;

-- households
CREATE POLICY hearth_households_select ON households
  FOR SELECT TO authenticated
  USING (hearth_is_active_member(id, environment));
CREATE POLICY hearth_households_insert ON households
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY hearth_households_update ON households
  FOR UPDATE TO authenticated
  USING (hearth_is_active_member(id, environment))
  WITH CHECK (hearth_is_active_member(id, environment));
-- no DELETE policy

-- household_snapshots
CREATE POLICY hearth_snapshots_select ON household_snapshots
  FOR SELECT TO authenticated
  USING (hearth_is_active_member(household_id, environment));
CREATE POLICY hearth_snapshots_insert ON household_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (hearth_is_active_member(household_id, environment));
CREATE POLICY hearth_snapshots_update ON household_snapshots
  FOR UPDATE TO authenticated
  USING (hearth_is_active_member(household_id, environment))
  WITH CHECK (hearth_is_active_member(household_id, environment));

-- continuity_memberships
CREATE POLICY hearth_continuity_memberships_select ON continuity_memberships
  FOR SELECT TO authenticated
  USING (hearth_is_active_member(household_id, environment));
CREATE POLICY hearth_continuity_memberships_insert ON continuity_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    OR hearth_is_household_owner(household_id, environment)
  );
CREATE POLICY hearth_continuity_memberships_update ON continuity_memberships
  FOR UPDATE TO authenticated
  USING (hearth_is_household_owner(household_id, environment))
  WITH CHECK (hearth_is_household_owner(household_id, environment));

-- continuity_personal_snapshots — own member_id only
CREATE POLICY hearth_continuity_personal_select ON continuity_personal_snapshots
  FOR SELECT TO authenticated
  USING (
    hearth_is_active_member(household_id, environment)
    AND member_id = (
      SELECT m.member_id FROM continuity_memberships m
      WHERE m.household_id = continuity_personal_snapshots.household_id
        AND m.environment = continuity_personal_snapshots.environment
        AND m.auth_user_id = auth.uid()
        AND m.active IS TRUE
        AND m.revoked_at IS NULL
      LIMIT 1
    )
  );
CREATE POLICY hearth_continuity_personal_insert ON continuity_personal_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    hearth_is_active_member(household_id, environment)
    AND member_id = (
      SELECT m.member_id FROM continuity_memberships m
      WHERE m.household_id = continuity_personal_snapshots.household_id
        AND m.environment = continuity_personal_snapshots.environment
        AND m.auth_user_id = auth.uid()
        AND m.active IS TRUE
        AND m.revoked_at IS NULL
      LIMIT 1
    )
  );
CREATE POLICY hearth_continuity_personal_update ON continuity_personal_snapshots
  FOR UPDATE TO authenticated
  USING (
    hearth_is_active_member(household_id, environment)
    AND member_id = (
      SELECT m.member_id FROM continuity_memberships m
      WHERE m.household_id = continuity_personal_snapshots.household_id
        AND m.environment = continuity_personal_snapshots.environment
        AND m.auth_user_id = auth.uid()
        AND m.active IS TRUE
        AND m.revoked_at IS NULL
      LIMIT 1
    )
  )
  WITH CHECK (
    hearth_is_active_member(household_id, environment)
    AND member_id = (
      SELECT m.member_id FROM continuity_memberships m
      WHERE m.household_id = continuity_personal_snapshots.household_id
        AND m.environment = continuity_personal_snapshots.environment
        AND m.auth_user_id = auth.uid()
        AND m.active IS TRUE
        AND m.revoked_at IS NULL
      LIMIT 1
    )
  );

-- Legacy normalized tables (if ever exposed): membership-scoped, no DELETE
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'members', 'categories', 'chart_accounts', 'journal_entries', 'journal_lines',
    'source_transactions', 'shifts', 'goals', 'budget_plans', 'recurrences',
    'activity', 'audit_revisions'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS hearth_%s_select ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS hearth_%s_write ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS hearth_%s_update ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY hearth_%s_select ON %I FOR SELECT TO authenticated USING (hearth_is_active_member(household_id, (SELECT environment FROM households h WHERE h.id = %I.household_id)))',
      t, t, t
    );
    EXECUTE format(
      'CREATE POLICY hearth_%s_write ON %I FOR INSERT TO authenticated WITH CHECK (hearth_is_active_member(household_id, (SELECT environment FROM households h WHERE h.id = %I.household_id)))',
      t, t, t
    );
    EXECUTE format(
      'CREATE POLICY hearth_%s_update ON %I FOR UPDATE TO authenticated USING (hearth_is_active_member(household_id, (SELECT environment FROM households h WHERE h.id = %I.household_id))) WITH CHECK (hearth_is_active_member(household_id, (SELECT environment FROM households h WHERE h.id = %I.household_id)))',
      t, t, t, t
    );
  END LOOP;
END $$;

-- invitations
CREATE POLICY hearth_invites_select ON household_invitations
  FOR SELECT TO authenticated
  USING (
    hearth_is_household_owner(household_id, environment)
    OR (kind = 'email' AND lower(invited_email) = hearth_jwt_email())
  );
CREATE POLICY hearth_invites_insert ON household_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    hearth_is_household_owner(household_id, environment)
    AND created_by_auth_user_id = auth.uid()
  );
CREATE POLICY hearth_invites_update ON household_invitations
  FOR UPDATE TO authenticated
  USING (hearth_is_household_owner(household_id, environment))
  WITH CHECK (hearth_is_household_owner(household_id, environment));

-- ---------------------------------------------------------------------------
-- 5. Grants: anon locked out of household REST (Q4)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE households FROM anon;
REVOKE ALL ON TABLE household_snapshots FROM anon;
REVOKE ALL ON TABLE continuity_memberships FROM anon;
REVOKE ALL ON TABLE continuity_personal_snapshots FROM anon;
REVOKE ALL ON TABLE household_invitations FROM anon;
REVOKE ALL ON TABLE members FROM anon;
REVOKE ALL ON TABLE categories FROM anon;
REVOKE ALL ON TABLE chart_accounts FROM anon;
REVOKE ALL ON TABLE journal_entries FROM anon;
REVOKE ALL ON TABLE journal_lines FROM anon;
REVOKE ALL ON TABLE source_transactions FROM anon;
REVOKE ALL ON TABLE shifts FROM anon;
REVOKE ALL ON TABLE goals FROM anon;
REVOKE ALL ON TABLE budget_plans FROM anon;
REVOKE ALL ON TABLE recurrences FROM anon;
REVOKE ALL ON TABLE activity FROM anon;
REVOKE ALL ON TABLE audit_revisions FROM anon;
REVOKE ALL ON v_unbalanced_entries, v_journal, v_trial_balance, v_income_statement, v_net_worth, v_catalog FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE households TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE household_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE continuity_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE continuity_personal_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE household_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE chart_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE journal_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE journal_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE source_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE goals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE budget_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE recurrences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE activity TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE audit_revisions TO authenticated;
GRANT SELECT ON v_unbalanced_entries, v_journal, v_trial_balance, v_income_statement, v_net_worth, v_catalog TO authenticated;

REVOKE DELETE ON TABLE households FROM authenticated;
REVOKE DELETE ON TABLE household_snapshots FROM authenticated;
REVOKE DELETE ON TABLE continuity_memberships FROM authenticated;
REVOKE DELETE ON TABLE continuity_personal_snapshots FROM authenticated;
REVOKE DELETE ON TABLE household_invitations FROM authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPCs: Create (owner), issue email/QR invite, redeem, revoke member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hearth_establish_owner_membership(
  p_environment TEXT,
  p_household_id TEXT,
  p_member_id TEXT,
  p_google_subject TEXT,
  p_google_email TEXT,
  p_display_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF p_environment NOT IN ('development', 'production') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-environment');
  END IF;

  INSERT INTO continuity_memberships (
    environment, household_id, member_id, google_subject, google_email,
    display_name, active, updated_at, auth_user_id, role, revoked_at
  ) VALUES (
    p_environment, p_household_id, p_member_id, coalesce(p_google_subject, ''),
    lower(coalesce(p_google_email, hearth_jwt_email())),
    coalesce(p_display_name, ''), TRUE, now()::text, auth.uid(), 'owner', NULL
  )
  ON CONFLICT (environment, household_id, member_id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    role = 'owner',
    google_subject = EXCLUDED.google_subject,
    google_email = EXCLUDED.google_email,
    display_name = EXCLUDED.display_name,
    active = TRUE,
    revoked_at = NULL,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true, 'role', 'owner');
END;
$$;

CREATE OR REPLACE FUNCTION hearth_issue_invite(
  p_environment TEXT,
  p_household_id TEXT,
  p_kind TEXT,
  p_invited_email TEXT DEFAULT NULL,
  p_ttl_hours INTEGER DEFAULT 168
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  token TEXT;
  invite_id UUID;
  expires TIMESTAMPTZ;
BEGIN
  IF NOT hearth_is_household_owner(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  IF p_kind NOT IN ('email', 'qr') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-kind');
  END IF;
  IF p_kind = 'email' AND (p_invited_email IS NULL OR length(trim(p_invited_email)) = 0) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-required');
  END IF;

  token := encode(gen_random_bytes(32), 'hex');
  expires := now() + make_interval(hours => GREATEST(1, LEAST(p_ttl_hours, 720)));
  INSERT INTO household_invitations (
    environment, household_id, kind, invite_token, invited_email,
    created_by_auth_user_id, status, expires_at
  ) VALUES (
    p_environment, p_household_id, p_kind, token,
    CASE WHEN p_kind = 'email' THEN lower(trim(p_invited_email)) ELSE NULL END,
    auth.uid(), 'pending', expires
  )
  RETURNING id INTO invite_id;

  RETURN jsonb_build_object(
    'ok', true,
    'id', invite_id,
    'kind', p_kind,
    'invite_token', token,
    'expires_at', expires,
    'join_path', '/join?invite=' || token || '&env=' || p_environment
  );
END;
$$;

CREATE OR REPLACE FUNCTION hearth_redeem_invite(
  p_invite_token TEXT,
  p_member_id TEXT,
  p_google_subject TEXT DEFAULT '',
  p_display_name TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  inv household_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO inv
  FROM household_invitations
  WHERE invite_token = p_invite_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found');
  END IF;
  IF inv.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-pending');
  END IF;
  IF inv.expires_at <= now() THEN
    UPDATE household_invitations SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF inv.kind = 'email' AND lower(inv.invited_email) IS DISTINCT FROM hearth_jwt_email() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-mismatch');
  END IF;

  INSERT INTO continuity_memberships (
    environment, household_id, member_id, google_subject, google_email,
    display_name, active, updated_at, auth_user_id, role, revoked_at
  ) VALUES (
    inv.environment, inv.household_id, p_member_id, coalesce(p_google_subject, ''),
    hearth_jwt_email(), coalesce(p_display_name, ''), TRUE, now()::text,
    auth.uid(), 'member', NULL
  )
  ON CONFLICT (environment, household_id, member_id) DO UPDATE SET
    auth_user_id = EXCLUDED.auth_user_id,
    role = 'member',
    google_subject = EXCLUDED.google_subject,
    google_email = EXCLUDED.google_email,
    display_name = EXCLUDED.display_name,
    active = TRUE,
    revoked_at = NULL,
    updated_at = EXCLUDED.updated_at;

  UPDATE household_invitations SET
    status = 'accepted',
    accepted_at = now(),
    accepted_by_auth_user_id = auth.uid()
  WHERE id = inv.id;

  RETURN jsonb_build_object(
    'ok', true,
    'role', 'member',
    'household_id', inv.household_id,
    'environment', inv.environment
  );
END;
$$;

CREATE OR REPLACE FUNCTION hearth_revoke_member(
  p_environment TEXT,
  p_household_id TEXT,
  p_member_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT hearth_is_household_owner(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  UPDATE continuity_memberships SET
    active = FALSE,
    revoked_at = now(),
    updated_at = now()::text
  WHERE environment = p_environment
    AND household_id = p_household_id
    AND member_id = p_member_id
    AND role IS DISTINCT FROM 'owner';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found-or-owner');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION hearth_establish_owner_membership(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_issue_invite(text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_redeem_invite(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_revoke_member(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hearth_establish_owner_membership(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_issue_invite(text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_redeem_invite(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_revoke_member(text, text, text) TO authenticated;

-- CAS RPC: revoke anon execute if 002 already applied. Member-guard body patch
-- belongs in a reviewed follow-up once both 002 and 004 are live (do not redefine
-- publish_household_snapshot here — it requires 002's revision/snapshot_hash columns).
DO $$
BEGIN
  IF to_regprocedure('publish_household_snapshot(text,integer,text,text,text,text,boolean,integer,text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION publish_household_snapshot(text, integer, text, text, text, text, boolean, integer, text, text, text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION publish_household_snapshot(text, integer, text, text, text, text, boolean, integer, text, text, text) FROM anon;
    GRANT EXECUTE ON FUNCTION publish_household_snapshot(text, integer, text, text, text, text, boolean, integer, text, text, text) TO authenticated;
  END IF;
END $$;

COMMIT;
