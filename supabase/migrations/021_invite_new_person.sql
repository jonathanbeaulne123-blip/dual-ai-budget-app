-- DO NOT APPLY without Jonathan's explicit migration authorization.
-- Invite reserves an inactive control-plane seat; redemption grants access.
-- No ledger snapshot writes: compatible with the v2 cutover fence.
BEGIN;
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
  new_person BOOLEAN := nullif(trim(p_member_id), '') IS NULL;
BEGIN
  IF NOT hearth_private.is_household_owner(p_household_id, p_environment) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  IF p_kind NOT IN ('email', 'qr') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad-kind'); END IF;
  IF p_role NOT IN ('owner', 'member') THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad-role'); END IF;
  IF p_kind = 'email' AND nullif(lower(trim(p_invited_email)), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-required');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );
  IF new_person THEN
    IF (SELECT count(*) FROM public.continuity_memberships
        WHERE environment=p_environment AND household_id=p_household_id
        AND active AND auth_user_id IS NOT NULL AND revoked_at IS NULL) >= 2 THEN
      RETURN jsonb_build_object('ok',false,'reason','house-full');
    END IF;
    -- Reuse the unbound vacancy so a replacement email/role choice revokes
    -- the earlier QR. Never reuse a retained Google identity or roster seat.
    SELECT m.member_id INTO p_member_id FROM public.continuity_memberships m
    WHERE m.environment=p_environment AND m.household_id=p_household_id
      AND NOT m.active AND m.auth_user_id IS NULL AND m.google_subject=''
      AND NOT EXISTS (
        SELECT 1 FROM public.household_snapshots s,
          jsonb_array_elements(coalesce(s.payload::jsonb->'members','[]'::jsonb)) person
        WHERE s.environment=p_environment AND s.household_id=p_household_id
          AND person->>'id'=m.member_id)
    ORDER BY m.member_id LIMIT 1;
    p_member_id := coalesce(p_member_id, 'MEM-' || gen_random_uuid()::text);
    member_name := 'Invited person';
  ELSE
    SELECT member ->> 'name' INTO member_name
    FROM public.household_snapshots AS snapshot,
         jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'members', '[]'::jsonb)) AS member
    WHERE snapshot.household_id=p_household_id AND snapshot.environment=p_environment
      AND member ->> 'id'=p_member_id AND coalesce((member ->> 'active')::boolean,true)
    LIMIT 1;
    IF member_name IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','member-not-in-household'); END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION public.hearth_redeem_invite(
  p_invite_token TEXT, p_display_name TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  invite public.household_invitations%ROWTYPE;
  resolved_subject TEXT;
  resolved_email TEXT;
  target_user UUID;
  target_subject TEXT;
  target_role TEXT;
  target_active BOOLEAN;
  invite_environment TEXT;
  invite_household_id TEXT;
  bound_member_count INTEGER;
BEGIN
  IF caller IS NULL OR NOT hearth_private.session_is_live() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'session-not-live');
  END IF;

  SELECT identity.provider_id,
         lower(coalesce(identity.identity_data ->> 'email', hearth_private.jwt_email()))
  INTO resolved_subject, resolved_email
  FROM auth.identities AS identity
  WHERE identity.user_id = caller AND identity.provider = 'google'
  LIMIT 1;

  IF resolved_subject IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'google-identity-required');
  END IF;

  SELECT environment, household_id
  INTO invite_environment, invite_household_id
  FROM public.household_invitations
  WHERE invite_token_hash = encode(sha256(convert_to(p_invite_token, 'UTF8')), 'hex');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      invite_environment || pg_catalog.chr(31) || invite_household_id,
      0
    )
  );

  SELECT *
  INTO invite
  FROM public.household_invitations
  WHERE invite_token_hash = encode(sha256(convert_to(p_invite_token, 'UTF8')), 'hex')
  FOR UPDATE;

  IF invite.status = 'accepted' AND invite.accepted_by_auth_user_id = caller THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'role', invite.target_role,
      'member_id', invite.target_member_id,
      'household_id', invite.household_id,
      'environment', invite.environment
    );
  END IF;

  IF invite.status = 'accepted' THEN
    SELECT count(*)
    INTO bound_member_count
    FROM public.continuity_memberships AS membership
    WHERE membership.environment = invite.environment
      AND membership.household_id = invite.household_id
      AND membership.auth_user_id IS NOT NULL
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL;

    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN bound_member_count >= 2 THEN 'house-full' ELSE 'not-pending' END
    );
  END IF;

  IF invite.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-pending');
  END IF;

  IF invite.expires_at <= now() THEN
    UPDATE public.household_invitations
    SET status = 'expired'
    WHERE id = invite.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF invite.kind = 'email'
     AND lower(invite.invited_email) IS DISTINCT FROM resolved_email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email-mismatch');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.continuity_memberships AS membership
    WHERE membership.environment = invite.environment
      AND membership.household_id = invite.household_id
      AND membership.auth_user_id = caller
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL
      AND membership.member_id IS DISTINCT FROM invite.target_member_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already-member');
  END IF;

  SELECT auth_user_id, google_subject, role, active
  INTO target_user, target_subject, target_role, target_active
  FROM public.continuity_memberships
  WHERE environment = invite.environment
    AND household_id = invite.household_id
    AND member_id = invite.target_member_id
  FOR UPDATE;

  IF target_user IS NOT NULL OR target_active IS TRUE THEN
    SELECT count(*)
    INTO bound_member_count
    FROM public.continuity_memberships AS membership
    WHERE membership.environment = invite.environment
      AND membership.household_id = invite.household_id
      AND membership.auth_user_id IS NOT NULL
      AND membership.active IS TRUE
      AND membership.revoked_at IS NULL;

    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN bound_member_count >= 2 THEN 'house-full' ELSE 'target-unavailable' END
    );
  END IF;

  IF target_role IS DISTINCT FROM invite.target_role THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'target-unavailable');
  END IF;

  IF target_subject <> '' AND target_subject IS DISTINCT FROM resolved_subject THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rejoin-identity-mismatch');
  END IF;

  IF nullif(trim(p_display_name),'') IS NULL OR length(trim(p_display_name)) > 80 THEN
    RETURN jsonb_build_object('ok',false,'reason','display-name-required');
  END IF;
  SELECT count(*) INTO bound_member_count FROM public.continuity_memberships
    WHERE environment=invite.environment AND household_id=invite.household_id
      AND active AND auth_user_id IS NOT NULL AND revoked_at IS NULL;
  IF bound_member_count >= 2 THEN RETURN jsonb_build_object('ok',false,'reason','house-full'); END IF;

  UPDATE public.continuity_memberships
  SET auth_user_id = caller,
      google_subject = resolved_subject,
      google_email = resolved_email,
      display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
      role = invite.target_role,
      active = true,
      revoked_at = NULL,
      updated_at = now()::text
  WHERE environment = invite.environment
    AND household_id = invite.household_id
    AND member_id = invite.target_member_id;

  UPDATE public.household_invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by_auth_user_id = caller
  WHERE id = invite.id;

  PERFORM hearth_private.identity_audit(
    invite.environment,
    invite.household_id,
    'invite-accepted',
    invite.target_member_id,
    invite.target_member_id,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'role', invite.target_role,
    'member_id', invite.target_member_id,
    'household_id', invite.household_id,
    'environment', invite.environment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hearth_redeem_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hearth_redeem_invite(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.hearth_issue_invite(text,text,text,text,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hearth_issue_invite(text,text,text,text,text,integer,text) TO authenticated;
INSERT INTO public.schema_migrations(id,applied_at) VALUES(21,now()::text) ON CONFLICT(id) DO UPDATE SET applied_at=EXCLUDED.applied_at;
COMMIT;
NOTIFY pgrst, 'reload schema';
