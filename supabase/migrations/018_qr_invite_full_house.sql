-- Migration 018 — distinguish a consumed two-seat QR invite from a generic stale invite.
--
-- This is a forward replacement of the migration-017 RPC. It changes no rows
-- during apply. The caller must still have a live Google/Supabase session; the
-- token remains one-time and exact-seat authority. A different account that
-- presents a QR already accepted into a two-person household receives only the
-- bounded reason "house-full" — never member identities, emails, or ledger data.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE id = 17) THEN
    RAISE EXCEPTION '018 blocked: migration 017 is missing.';
  END IF;
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

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (18, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
