-- Synthetic local-only authorization fixture for Readiness 3.
-- It models the shape of Hearth's Auth/RLS boundary without contacting Supabase.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE SCHEMA auth;
CREATE SCHEMA hearth_private;

CREATE FUNCTION auth.uid() RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '');
$$;

CREATE FUNCTION auth.session_id() RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.session_id', true), '');
$$;

CREATE TABLE continuity_memberships (
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  auth_user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  active BOOLEAN NOT NULL,
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (environment, household_id, member_id)
);

CREATE TABLE hearth_member_sessions (
  environment TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  auth_user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (environment, household_id, session_id)
);

CREATE TABLE household_snapshots (
  environment TEXT NOT NULL,
  household_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (environment, household_id)
);

CREATE TABLE continuity_personal_snapshots (
  environment TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (environment, household_id, member_id)
);

CREATE TABLE household_invitations (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  household_id TEXT NOT NULL,
  target_member_id TEXT NOT NULL,
  invited_email TEXT,
  status TEXT NOT NULL
);

CREATE TABLE realtime_topics (
  topic TEXT PRIMARY KEY,
  environment TEXT NOT NULL,
  household_id TEXT NOT NULL
);

CREATE FUNCTION hearth_private.membership_session_allowed(
  requested_environment TEXT,
  requested_household_id TEXT,
  requested_member_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.hearth_member_sessions AS registered
    WHERE registered.environment = requested_environment
      AND registered.household_id = requested_household_id
      AND registered.member_id = requested_member_id
  ) OR EXISTS (
    SELECT 1
    FROM public.hearth_member_sessions AS registered
    WHERE registered.environment = requested_environment
      AND registered.household_id = requested_household_id
      AND registered.member_id = requested_member_id
      AND registered.auth_user_id = auth.uid()
      AND registered.session_id = auth.session_id()
      AND registered.revoked_at IS NULL
  );
$$;

CREATE FUNCTION hearth_private.is_active_member(
  requested_environment TEXT,
  requested_household_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.continuity_memberships AS membership
    WHERE membership.environment = requested_environment
      AND membership.household_id = requested_household_id
      AND membership.auth_user_id = auth.uid()
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL
      AND hearth_private.membership_session_allowed(
        membership.environment,
        membership.household_id,
        membership.member_id
      )
  );
$$;

CREATE FUNCTION hearth_private.own_member_id(
  requested_environment TEXT,
  requested_household_id TEXT
) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT membership.member_id
  FROM public.continuity_memberships AS membership
  WHERE membership.environment = requested_environment
    AND membership.household_id = requested_household_id
    AND membership.auth_user_id = auth.uid()
    AND membership.active IS TRUE
    AND membership.revoked_at IS NULL
    AND hearth_private.membership_session_allowed(
      membership.environment,
      membership.household_id,
      membership.member_id
    )
  LIMIT 1;
$$;

CREATE FUNCTION hearth_private.is_owner(
  requested_environment TEXT,
  requested_household_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.continuity_memberships AS membership
    WHERE membership.environment = requested_environment
      AND membership.household_id = requested_household_id
      AND membership.auth_user_id = auth.uid()
      AND membership.role = 'owner'
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL
      AND hearth_private.membership_session_allowed(
        membership.environment,
        membership.household_id,
        membership.member_id
      )
  );
$$;

ALTER TABLE household_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuity_personal_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuity_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY shared_select ON household_snapshots
FOR SELECT TO authenticated
USING (
  /* SHARED_SELECT_PREDICATE */
  hearth_private.is_active_member(environment, household_id)
);

CREATE POLICY personal_select ON continuity_personal_snapshots
FOR SELECT TO authenticated
USING (
  member_id = hearth_private.own_member_id(environment, household_id)
);

CREATE POLICY personal_insert ON continuity_personal_snapshots
FOR INSERT TO authenticated
WITH CHECK (
  member_id = hearth_private.own_member_id(environment, household_id)
);

CREATE POLICY personal_update ON continuity_personal_snapshots
FOR UPDATE TO authenticated
USING (
  member_id = hearth_private.own_member_id(environment, household_id)
)
WITH CHECK (
  member_id = hearth_private.own_member_id(environment, household_id)
);

CREATE POLICY membership_select ON continuity_memberships
FOR SELECT TO authenticated
USING (
  hearth_private.is_active_member(environment, household_id)
);

CREATE POLICY invitation_select ON household_invitations
FOR SELECT TO authenticated
USING (
  hearth_private.is_owner(environment, household_id)
  OR lower(coalesce(invited_email, '')) = lower(current_setting('request.jwt.claim.email', true))
);

CREATE POLICY realtime_subscribe ON realtime_topics
FOR SELECT TO authenticated
USING (
  hearth_private.is_active_member(environment, household_id)
);

GRANT USAGE ON SCHEMA public, auth, hearth_private TO authenticated;
GRANT SELECT ON
  household_snapshots,
  continuity_memberships,
  household_invitations,
  realtime_topics
TO authenticated;
GRANT SELECT, INSERT, UPDATE ON continuity_personal_snapshots TO authenticated;

CREATE FUNCTION hearth_issue_invite_test(
  requested_environment TEXT,
  requested_household_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hearth_private.is_owner(requested_environment, requested_household_id);
$$;

CREATE FUNCTION hearth_publish_test(
  requested_environment TEXT,
  requested_household_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hearth_private.is_active_member(requested_environment, requested_household_id);
$$;

CREATE FUNCTION hearth_remove_member_test(
  requested_environment TEXT,
  requested_household_id TEXT,
  target_member_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hearth_private.is_owner(requested_environment, requested_household_id)
    AND target_member_id IS DISTINCT FROM hearth_private.own_member_id(
      requested_environment,
      requested_household_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.continuity_memberships AS target
      WHERE target.environment = requested_environment
        AND target.household_id = requested_household_id
        AND target.member_id = target_member_id
        AND target.role = 'member'
        AND target.active IS TRUE
        AND target.revoked_at IS NULL
    );
$$;

CREATE FUNCTION hearth_leave_household_test(
  requested_environment TEXT,
  requested_household_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.continuity_memberships AS actor
    WHERE actor.environment = requested_environment
      AND actor.household_id = requested_household_id
      AND actor.auth_user_id = auth.uid()
      AND actor.active IS TRUE
      AND actor.revoked_at IS NULL
      AND hearth_private.membership_session_allowed(
        actor.environment,
        actor.household_id,
        actor.member_id
      )
      AND (
        actor.role <> 'owner'
        OR 1 < (
          SELECT count(*)
          FROM public.continuity_memberships AS owner
          WHERE owner.environment = actor.environment
            AND owner.household_id = actor.household_id
            AND owner.role = 'owner'
            AND owner.active IS TRUE
            AND owner.revoked_at IS NULL
        )
      )
  );
$$;

CREATE FUNCTION hearth_create_household_test(
  requested_environment TEXT,
  requested_household_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND requested_environment IN ('development', 'production')
    AND NOT EXISTS (
      SELECT 1 FROM public.household_snapshots AS household
      WHERE household.environment = requested_environment
        AND household.household_id = requested_household_id
    );
$$;

REVOKE ALL ON FUNCTION hearth_issue_invite_test(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_publish_test(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_remove_member_test(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_leave_household_test(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION hearth_create_household_test(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hearth_issue_invite_test(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_publish_test(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_remove_member_test(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_leave_household_test(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION hearth_create_household_test(TEXT, TEXT) TO authenticated;

INSERT INTO continuity_memberships (
  environment, household_id, member_id, auth_user_id, role, active, revoked_at
) VALUES
  ('development', 'H1', 'M-A', 'USER-A', 'owner', true, NULL),
  ('development', 'H1', 'M-B', 'USER-B', 'member', true, NULL),
  ('development', 'H2', 'M-C', 'USER-C', 'owner', true, NULL),
  ('production', 'H1', 'M-A-PROD', 'USER-A', 'owner', true, NULL);

INSERT INTO hearth_member_sessions (
  environment, household_id, member_id, auth_user_id, session_id, revoked_at
) VALUES
  ('development', 'H1', 'M-A', 'USER-A', 'SESSION-A', NULL),
  ('development', 'H1', 'M-A', 'USER-A', 'SESSION-A-REVOKED', '2026-09-04T00:00:00Z'),
  ('development', 'H1', 'M-B', 'USER-B', 'SESSION-B', NULL),
  ('development', 'H2', 'M-C', 'USER-C', 'SESSION-C', NULL),
  ('development', 'H2', 'M-C', 'USER-C', 'SESSION-C-REVOKED', '2026-09-04T00:00:00Z'),
  ('production', 'H1', 'M-A-PROD', 'USER-A', 'SESSION-A-PROD', NULL);

INSERT INTO household_snapshots (environment, household_id, revision) VALUES
  ('development', 'H1', 1),
  ('development', 'H2', 1),
  ('production', 'H1', 1);

INSERT INTO continuity_personal_snapshots (
  environment, household_id, member_id, revision
) VALUES
  ('development', 'H1', 'M-A', 1),
  ('development', 'H1', 'M-B', 1),
  ('production', 'H1', 'M-A-PROD', 1);

INSERT INTO household_invitations (
  id, environment, household_id, target_member_id, invited_email, status
) VALUES
  ('INV-H1', 'development', 'H1', 'M-NEW', 'invitee@example.test', 'pending');

INSERT INTO realtime_topics (topic, environment, household_id) VALUES
  ('development:H1', 'development', 'H1'),
  ('development:H2', 'development', 'H2'),
  ('production:H1', 'production', 'H1');
