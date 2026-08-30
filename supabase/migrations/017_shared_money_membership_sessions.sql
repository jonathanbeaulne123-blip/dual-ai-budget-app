-- Migration 017 — SF-02 co-owner membership and authenticated device access.
-- LOCAL RELEASE PACKET ONLY. Do not apply to Development or Production without
-- Jonathan's separate approval and the SF-02 hosted/RLS smoke plan.
--
-- Existing household.devices are soft presence. hearth_member_sessions is the
-- authorization registry: the JWT session_id remains the unforgeable handle.
-- Revocation denies hosted reads/writes immediately, but cannot erase an offline
-- browser's already-cached local books.

BEGIN;

ALTER TABLE public.household_invitations
  ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE public.household_invitations
  DROP CONSTRAINT IF EXISTS household_invitations_target_role_check;
ALTER TABLE public.household_invitations
  ADD CONSTRAINT household_invitations_target_role_check
  CHECK (target_role IN ('owner', 'member'));

-- Normalize the migration-006 pending model before session gating: retain only
-- the newest pending token per seat and make that seat inactive until redeem.
WITH ranked_pending AS (
  SELECT id, row_number() OVER (
    PARTITION BY environment, household_id, target_member_id
    ORDER BY created_at DESC, id DESC
  ) AS pending_rank
  FROM public.household_invitations
  WHERE status = 'pending'
)
UPDATE public.household_invitations AS invitation
SET status = 'revoked', revoked_at = now()
FROM ranked_pending
WHERE invitation.id = ranked_pending.id AND ranked_pending.pending_rank > 1;

UPDATE public.continuity_memberships AS membership
SET active = false, revoked_at = NULL, updated_at = now()::text,
    role = invitation.target_role
FROM public.household_invitations AS invitation
WHERE invitation.environment = membership.environment
  AND invitation.household_id = membership.household_id
  AND invitation.target_member_id = membership.member_id
  AND invitation.status = 'pending'
  AND membership.auth_user_id IS NULL;

CREATE TABLE IF NOT EXISTS public.hearth_member_sessions (
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  access_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  device_id TEXT NOT NULL CHECK (device_id ~ '^DEV-[A-F0-9]{16}$'),
  device_label TEXT NOT NULL CHECK (length(device_label) BETWEEN 1 AND 48),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_by_member_id TEXT,
  revoke_reason TEXT,
  PRIMARY KEY (environment, household_id, session_id),
  FOREIGN KEY (environment, household_id, member_id)
    REFERENCES public.continuity_memberships(environment, household_id, member_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS hearth_member_sessions_active_household
  ON public.hearth_member_sessions (environment, household_id, member_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS hearth_member_sessions_auth_session
  ON public.hearth_member_sessions (auth_user_id, session_id);
CREATE INDEX IF NOT EXISTS hearth_member_sessions_active_device
  ON public.hearth_member_sessions (environment, household_id, device_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hearth_identity_audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  actor_member_id TEXT,
  target_member_id TEXT,
  target_device_id TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'invite-issued', 'invite-accepted', 'member-revoked', 'member-left',
    'device-registered', 'device-revoked'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hearth_identity_audit_household_recent
  ON public.hearth_identity_audit_events (environment, household_id, occurred_at DESC);

ALTER TABLE public.hearth_member_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hearth_identity_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.hearth_member_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.hearth_identity_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.hearth_identity_audit_events_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION hearth_private.current_session_id()
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE raw_session TEXT := auth.jwt() ->> 'session_id';
BEGIN
  IF raw_session IS NULL OR raw_session = '' THEN RETURN NULL; END IF;
  RETURN raw_session::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION hearth_private.session_is_live()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND hearth_private.current_session_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM auth.sessions AS session
      WHERE session.id = hearth_private.current_session_id()
        AND session.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION hearth_private.membership_session_allowed(
  p_environment TEXT, p_household_id TEXT, p_member_id TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT hearth_private.session_is_live()
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.hearth_member_sessions AS registered
        WHERE registered.environment = p_environment
          AND registered.household_id = p_household_id
          AND registered.member_id = p_member_id
      )
      OR EXISTS (
        SELECT 1 FROM public.hearth_member_sessions AS registered
        WHERE registered.environment = p_environment
          AND registered.household_id = p_household_id
          AND registered.member_id = p_member_id
          AND registered.auth_user_id = auth.uid()
          AND registered.session_id = hearth_private.current_session_id()
          AND registered.revoked_at IS NULL
      )
    );
$$;

CREATE OR REPLACE FUNCTION hearth_private.is_active_member(
  p_household_id TEXT, p_environment TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.continuity_memberships AS membership
    WHERE membership.household_id = p_household_id
      AND membership.environment = p_environment
      AND membership.auth_user_id = auth.uid()
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL
      AND hearth_private.membership_session_allowed(
        membership.environment, membership.household_id, membership.member_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION hearth_private.is_household_owner(
  p_household_id TEXT, p_environment TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.continuity_memberships AS membership
    WHERE membership.household_id = p_household_id
      AND membership.environment = p_environment
      AND membership.auth_user_id = auth.uid()
      AND membership.role = 'owner'
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL
      AND hearth_private.membership_session_allowed(
        membership.environment, membership.household_id, membership.member_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION hearth_private.own_member_id(
  p_household_id TEXT, p_environment TEXT
) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT membership.member_id
  FROM public.continuity_memberships AS membership
  WHERE membership.household_id = p_household_id
    AND membership.environment = p_environment
    AND membership.auth_user_id = auth.uid()
    AND membership.active IS TRUE
    AND membership.revoked_at IS NULL
    AND hearth_private.membership_session_allowed(
      membership.environment, membership.household_id, membership.member_id
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION hearth_private.identity_audit(
  p_environment TEXT, p_household_id TEXT, p_action TEXT,
  p_actor_member_id TEXT DEFAULT NULL, p_target_member_id TEXT DEFAULT NULL,
  p_target_device_id TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO public.hearth_identity_audit_events (
    environment, household_id, action, actor_member_id,
    target_member_id, target_device_id
  ) VALUES (
    p_environment, p_household_id, p_action, p_actor_member_id,
    p_target_member_id, p_target_device_id
  );
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hearth_private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hearth_private TO authenticated;
-- identity_audit mutates trusted metadata and is callable only from the outer
-- SECURITY DEFINER lifecycle RPCs, never directly by an authenticated client.
REVOKE EXECUTE ON FUNCTION hearth_private.identity_audit(text, text, text, text, text, text)
  FROM authenticated;

CREATE OR REPLACE FUNCTION public.hearth_register_current_device(
  p_environment TEXT, p_device_id TEXT, p_device_label TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  current_session UUID := hearth_private.current_session_id();
  membership RECORD;
  registered_count INTEGER := 0;
  affected_count INTEGER := 0;
  already_registered BOOLEAN := false;
BEGIN
  IF p_environment NOT IN ('development', 'production') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-environment');
  END IF;
  IF caller IS NULL OR NOT hearth_private.session_is_live() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session-not-live');
  END IF;
  IF coalesce(p_device_id, '') !~ '^DEV-[A-F0-9]{16}$'
    OR length(trim(coalesce(p_device_label, ''))) NOT BETWEEN 1 AND 48 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-device');
  END IF;

  FOR membership IN
    SELECT environment, household_id, member_id
    FROM public.continuity_memberships
    WHERE environment = p_environment
      AND auth_user_id = caller AND active IS TRUE AND revoked_at IS NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.hearth_member_sessions
      WHERE environment = membership.environment
        AND household_id = membership.household_id
        AND session_id = current_session AND revoked_at IS NOT NULL
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'device-revoked');
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.hearth_member_sessions
      WHERE environment = membership.environment
        AND household_id = membership.household_id
        AND session_id = current_session
    ) INTO already_registered;
    INSERT INTO public.hearth_member_sessions (
      environment, household_id, member_id, auth_user_id, session_id,
      device_id, device_label
    ) VALUES (
      membership.environment, membership.household_id, membership.member_id,
      caller, current_session, p_device_id, trim(p_device_label)
    ) ON CONFLICT (environment, household_id, session_id) DO UPDATE
      SET device_id = EXCLUDED.device_id,
          device_label = EXCLUDED.device_label,
          last_seen_at = now()
      WHERE public.hearth_member_sessions.revoked_at IS NULL;
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    registered_count := registered_count + affected_count;
    IF NOT already_registered THEN
      PERFORM hearth_private.identity_audit(
        membership.environment, membership.household_id, 'device-registered',
        membership.member_id, membership.member_id, p_device_id
      );
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'registered', registered_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_list_household_access(
  p_environment TEXT, p_household_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE caller_member TEXT;
BEGIN
  IF NOT hearth_private.is_active_member(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-member');
  END IF;
  caller_member := hearth_private.own_member_id(p_household_id, p_environment);
  RETURN jsonb_build_object(
    'ok', true,
    'current_member_id', caller_member,
    'current_role', (
      SELECT role FROM public.continuity_memberships
      WHERE environment = p_environment AND household_id = p_household_id
        AND member_id = caller_member
    ),
    'members', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'display_name', display_name, 'role', role
      ) ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, display_name)
      FROM public.continuity_memberships
      WHERE environment = p_environment AND household_id = p_household_id
        AND active IS TRUE AND revoked_at IS NULL
    ), '[]'::jsonb),
    'devices', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', member_id, 'access_id', access_id, 'device_label', device_label,
        'registered_at', registered_at, 'last_seen_at', last_seen_at,
        'current', session_id = hearth_private.current_session_id()
      ) ORDER BY last_seen_at DESC)
      FROM public.hearth_member_sessions
      WHERE environment = p_environment AND household_id = p_household_id
        AND revoked_at IS NULL
    ), '[]'::jsonb),
    'audit', coalesce((
      SELECT jsonb_agg(event ORDER BY occurred_at DESC)
      FROM (
        SELECT action, actor_member_id, target_member_id, target_device_id, occurred_at
        FROM public.hearth_identity_audit_events
        WHERE environment = p_environment AND household_id = p_household_id
        ORDER BY occurred_at DESC LIMIT 20
      ) AS event
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_revoke_device(
  p_environment TEXT, p_household_id TEXT, p_access_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller_member TEXT;
  caller_owner BOOLEAN;
  target_member TEXT;
  target_device TEXT;
BEGIN
  IF NOT hearth_private.is_active_member(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-member');
  END IF;
  caller_member := hearth_private.own_member_id(p_household_id, p_environment);
  caller_owner := hearth_private.is_household_owner(p_household_id, p_environment);
  SELECT member_id, device_id INTO target_member, target_device
  FROM public.hearth_member_sessions
  WHERE environment = p_environment AND household_id = p_household_id
    AND access_id = p_access_id AND revoked_at IS NULL
  FOR UPDATE;
  IF target_member IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'device-not-found');
  END IF;
  IF NOT caller_owner AND target_member IS DISTINCT FROM caller_member THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  UPDATE public.hearth_member_sessions
  SET revoked_at = now(), revoked_by_member_id = caller_member,
      revoke_reason = 'household-access-panel'
  WHERE environment = p_environment AND household_id = p_household_id
    AND access_id = p_access_id AND revoked_at IS NULL;
  PERFORM hearth_private.identity_audit(
    p_environment, p_household_id, 'device-revoked', caller_member,
    target_member, target_device
  );
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Seven-argument SF-02 authority path.
CREATE OR REPLACE FUNCTION public.hearth_issue_invite(
  p_environment TEXT, p_household_id TEXT, p_member_id TEXT, p_kind TEXT,
  p_invited_email TEXT, p_ttl_hours INTEGER, p_role TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  raw_token TEXT; token_hash TEXT; invite_id UUID; expires TIMESTAMPTZ;
  member_name TEXT; membership_user UUID; membership_role TEXT;
  prior_google_subject TEXT; prior_google_email TEXT; membership_active BOOLEAN;
  actor_member TEXT;
BEGIN
  IF NOT hearth_private.is_household_owner(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  IF p_kind NOT IN ('email', 'qr') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad-kind'); END IF;
  IF p_role NOT IN ('owner', 'member') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad-role'); END IF;
  IF p_kind = 'email' AND nullif(lower(trim(p_invited_email)), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-required');
  END IF;
  SELECT member ->> 'name' INTO member_name
  FROM public.household_snapshots AS snapshot,
       jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'members', '[]'::jsonb)) AS member
  WHERE snapshot.household_id = p_household_id AND snapshot.environment = p_environment
    AND member ->> 'id' = p_member_id AND coalesce((member ->> 'active')::boolean, true)
  LIMIT 1;
  IF member_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'member-not-in-household'); END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );

  INSERT INTO public.continuity_memberships (
    environment, household_id, member_id, google_subject, google_email,
    display_name, active, updated_at, auth_user_id, role, revoked_at
  ) VALUES (
    p_environment, p_household_id, p_member_id, '',
    CASE WHEN p_kind = 'email' THEN lower(trim(p_invited_email)) ELSE '' END,
    member_name, false, now()::text, NULL, p_role, NULL
  ) ON CONFLICT (environment, household_id, member_id) DO UPDATE
    SET role = EXCLUDED.role,
        google_email = CASE
          WHEN public.continuity_memberships.google_subject = '' THEN EXCLUDED.google_email
          ELSE public.continuity_memberships.google_email
        END,
        active = false, updated_at = now()::text
    WHERE public.continuity_memberships.auth_user_id IS NULL;

  SELECT auth_user_id, role, google_subject, google_email, active
  INTO membership_user, membership_role, prior_google_subject, prior_google_email, membership_active
  FROM public.continuity_memberships
  WHERE environment = p_environment AND household_id = p_household_id AND member_id = p_member_id
  FOR UPDATE;
  IF membership_user IS NOT NULL OR membership_active IS TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'member-already-bound');
  END IF;
  IF membership_role IS DISTINCT FROM p_role THEN RETURN jsonb_build_object('ok', false, 'reason', 'target-unavailable'); END IF;
  IF prior_google_subject <> '' AND p_kind <> 'email' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rejoin-email-required');
  END IF;
  IF prior_google_subject <> '' AND lower(trim(p_invited_email)) IS DISTINCT FROM lower(prior_google_email) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rejoin-identity-mismatch');
  END IF;

  -- A replacement invitation is the only live authority for this seat. This
  -- prevents an older co-owner QR from surviving a later member/email choice.
  UPDATE public.household_invitations
  SET status = 'revoked', revoked_at = now()
  WHERE environment = p_environment AND household_id = p_household_id
    AND target_member_id = p_member_id AND status = 'pending';

  raw_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  token_hash := encode(sha256(convert_to(raw_token, 'UTF8')), 'hex');
  expires := now() + make_interval(hours => greatest(1, least(p_ttl_hours, 720)));
  INSERT INTO public.household_invitations (
    environment, household_id, target_member_id, target_role, kind,
    invite_token_hash, invited_email, created_by_auth_user_id, status, expires_at
  ) VALUES (
    p_environment, p_household_id, p_member_id, p_role, p_kind, token_hash,
    CASE WHEN p_kind = 'email' THEN lower(trim(p_invited_email)) ELSE NULL END,
    auth.uid(), 'pending', expires
  ) RETURNING id INTO invite_id;
  actor_member := hearth_private.own_member_id(p_household_id, p_environment);
  PERFORM hearth_private.identity_audit(
    p_environment, p_household_id, 'invite-issued', actor_member, p_member_id, NULL
  );
  RETURN jsonb_build_object(
    'ok', true, 'id', invite_id, 'kind', p_kind, 'role', p_role,
    'invite_token', raw_token, 'expires_at', expires,
    'join_path', '/join?invite=' || raw_token || '&env=' || p_environment
  );
END;
$$;

-- Compatibility for pre-SF-02 clients. It delegates to the same inactive,
-- stale-token-revoking path and can create only an ordinary member.
CREATE OR REPLACE FUNCTION public.hearth_issue_invite(
  p_environment TEXT, p_household_id TEXT, p_member_id TEXT, p_kind TEXT,
  p_invited_email TEXT DEFAULT NULL, p_ttl_hours INTEGER DEFAULT 168
) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.hearth_issue_invite(
    p_environment, p_household_id, p_member_id, p_kind,
    p_invited_email, p_ttl_hours, 'member'
  );
$$;

CREATE OR REPLACE FUNCTION public.hearth_redeem_invite(
  p_invite_token TEXT, p_display_name TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid(); invite public.household_invitations%ROWTYPE;
  resolved_subject TEXT; resolved_email TEXT; target_user UUID; target_subject TEXT;
  target_role TEXT; target_active BOOLEAN;
  invite_environment TEXT; invite_household_id TEXT;
BEGIN
  IF caller IS NULL OR NOT hearth_private.session_is_live() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session-not-live');
  END IF;
  SELECT identity.provider_id,
         lower(coalesce(identity.identity_data ->> 'email', hearth_private.jwt_email()))
  INTO resolved_subject, resolved_email
  FROM auth.identities AS identity
  WHERE identity.user_id = caller AND identity.provider = 'google' LIMIT 1;
  IF resolved_subject IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'google-identity-required'); END IF;
  SELECT environment, household_id INTO invite_environment, invite_household_id
  FROM public.household_invitations
  WHERE invite_token_hash = encode(sha256(convert_to(p_invite_token, 'UTF8')), 'hex');
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not-found'); END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(invite_environment || pg_catalog.chr(31) || invite_household_id, 0)
  );
  SELECT * INTO invite FROM public.household_invitations
  WHERE invite_token_hash = encode(sha256(convert_to(p_invite_token, 'UTF8')), 'hex') FOR UPDATE;
  IF invite.status = 'accepted' AND invite.accepted_by_auth_user_id = caller THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'role', invite.target_role,
      'member_id', invite.target_member_id, 'household_id', invite.household_id,
      'environment', invite.environment);
  END IF;
  IF invite.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not-pending'); END IF;
  IF invite.expires_at <= now() THEN
    UPDATE public.household_invitations SET status = 'expired' WHERE id = invite.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF invite.kind = 'email' AND lower(invite.invited_email) IS DISTINCT FROM resolved_email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-mismatch');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.continuity_memberships
    WHERE environment = invite.environment AND household_id = invite.household_id
      AND auth_user_id = caller AND active IS TRUE AND revoked_at IS NULL
      AND member_id IS DISTINCT FROM invite.target_member_id
  ) THEN RETURN jsonb_build_object('ok', false, 'reason', 'already-member'); END IF;
  SELECT auth_user_id, google_subject, role, active
  INTO target_user, target_subject, target_role, target_active
  FROM public.continuity_memberships
  WHERE environment = invite.environment AND household_id = invite.household_id
    AND member_id = invite.target_member_id FOR UPDATE;
  IF target_user IS NOT NULL OR target_active IS TRUE OR target_role IS DISTINCT FROM invite.target_role THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target-unavailable');
  END IF;
  IF target_subject <> '' AND target_subject IS DISTINCT FROM resolved_subject THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rejoin-identity-mismatch');
  END IF;
  UPDATE public.continuity_memberships
  SET auth_user_id = caller, google_subject = resolved_subject, google_email = resolved_email,
      display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
      role = invite.target_role, active = true, revoked_at = NULL, updated_at = now()::text
  WHERE environment = invite.environment AND household_id = invite.household_id
    AND member_id = invite.target_member_id;
  UPDATE public.household_invitations SET status = 'accepted', accepted_at = now(),
    accepted_by_auth_user_id = caller WHERE id = invite.id;
  PERFORM hearth_private.identity_audit(invite.environment, invite.household_id,
    'invite-accepted', invite.target_member_id, invite.target_member_id, NULL);
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'role', invite.target_role,
    'member_id', invite.target_member_id, 'household_id', invite.household_id,
    'environment', invite.environment);
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_revoke_member(
  p_environment TEXT, p_household_id TEXT, p_member_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE caller_member TEXT;
BEGIN
  IF NOT hearth_private.is_household_owner(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  caller_member := hearth_private.own_member_id(p_household_id, p_environment);
  IF EXISTS (
    SELECT 1 FROM public.continuity_memberships
    WHERE environment = p_environment AND household_id = p_household_id
      AND member_id = p_member_id AND role = 'owner'
      AND active IS TRUE AND revoked_at IS NULL
  ) THEN RETURN jsonb_build_object('ok', false, 'reason', 'co-owner-protected'); END IF;
  UPDATE public.continuity_memberships
  SET active = false, revoked_at = now(), updated_at = now()::text,
      auth_user_id = NULL
  WHERE environment = p_environment AND household_id = p_household_id
    AND member_id = p_member_id AND role = 'member'
    AND auth_user_id IS DISTINCT FROM auth.uid()
    AND active IS TRUE AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not-found-owner-or-self'); END IF;
  UPDATE public.hearth_member_sessions SET revoked_at = now(),
    revoked_by_member_id = caller_member, revoke_reason = 'membership-revoked'
  WHERE environment = p_environment AND household_id = p_household_id
    AND member_id = p_member_id AND revoked_at IS NULL;
  PERFORM hearth_private.identity_audit(p_environment, p_household_id,
    'member-revoked', caller_member, p_member_id, NULL);
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_leave_household(
  p_environment TEXT, p_household_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE caller UUID := auth.uid(); caller_member TEXT; caller_role TEXT; owner_count INTEGER;
BEGIN
  IF caller IS NULL OR NOT hearth_private.is_active_member(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-member');
  END IF;
  -- Serialize every leave decision for one household. Without this lock, two
  -- co-owners could both observe owner_count = 2 and orphan the household.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );
  SELECT member_id, role INTO caller_member, caller_role
  FROM public.continuity_memberships
  WHERE environment = p_environment AND household_id = p_household_id
    AND auth_user_id = caller AND active IS TRUE AND revoked_at IS NULL FOR UPDATE;
  SELECT count(*) INTO owner_count FROM public.continuity_memberships
  WHERE environment = p_environment AND household_id = p_household_id
    AND role = 'owner' AND active IS TRUE AND revoked_at IS NULL;
  IF caller_role = 'owner' AND owner_count <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'last-owner');
  END IF;
  UPDATE public.continuity_memberships SET active = false, revoked_at = now(),
    updated_at = now()::text, auth_user_id = NULL
  WHERE environment = p_environment AND household_id = p_household_id
    AND member_id = caller_member;
  UPDATE public.hearth_member_sessions SET revoked_at = now(),
    revoked_by_member_id = caller_member, revoke_reason = 'member-left'
  WHERE environment = p_environment AND household_id = p_household_id
    AND member_id = caller_member AND revoked_at IS NULL;
  PERFORM hearth_private.identity_audit(p_environment, p_household_id,
    'member-left', caller_member, caller_member, NULL);
  RETURN jsonb_build_object('ok', true, 'mode', 'leave',
    'household_id', p_household_id, 'former_role', caller_role);
END;
$$;

-- Re-close migration 016 through the SF-02 session gate. Owner deletes remain
-- Development-only; member exits use the audited leave RPC.
CREATE OR REPLACE FUNCTION public.hearth_reset_development_households()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  deleted_ids TEXT[];
  left_ids TEXT[];
  target_household TEXT;
BEGIN
  IF caller IS NULL OR NOT hearth_private.session_is_live() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session-not-live');
  END IF;
  SELECT coalesce(array_agg(DISTINCT membership.household_id), ARRAY[]::TEXT[])
  INTO deleted_ids
  FROM public.continuity_memberships AS membership
  JOIN public.households AS household ON household.id = membership.household_id
    AND household.environment = 'development'
  WHERE membership.environment = 'development' AND membership.auth_user_id = caller
    AND membership.role = 'owner' AND membership.active IS TRUE
    AND membership.revoked_at IS NULL
    AND hearth_private.is_household_owner(membership.household_id, 'development');

  SELECT coalesce(array_agg(DISTINCT membership.household_id), ARRAY[]::TEXT[])
  INTO left_ids
  FROM public.continuity_memberships AS membership
  JOIN public.households AS household ON household.id = membership.household_id
    AND household.environment = 'development'
  WHERE membership.environment = 'development' AND membership.auth_user_id = caller
    AND membership.role = 'member' AND membership.active IS TRUE
    AND membership.revoked_at IS NULL
    AND hearth_private.is_active_member(membership.household_id, 'development')
    AND NOT (membership.household_id = ANY (deleted_ids));

  IF array_length(deleted_ids, 1) IS NOT NULL THEN
    DELETE FROM public.households
    WHERE environment = 'development' AND id = ANY (deleted_ids);
  END IF;
  FOREACH target_household IN ARRAY left_ids LOOP
    PERFORM public.hearth_leave_household('development', target_household);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'mode', 'reset',
    'deleted', to_jsonb(deleted_ids), 'left', to_jsonb(left_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.hearth_register_current_device(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_list_household_access(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_revoke_device(text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_issue_invite(text, text, text, text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_issue_invite(text, text, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_redeem_invite(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_revoke_member(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_leave_household(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_reset_development_households() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.hearth_register_current_device(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_list_household_access(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_revoke_device(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_issue_invite(text, text, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_issue_invite(text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_redeem_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_revoke_member(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_leave_household(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_reset_development_households() TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (17, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
