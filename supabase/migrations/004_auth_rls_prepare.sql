-- DO NOT APPLY without Jonathan's separate Development approval.
-- Additive Auth/RLS preparation for D-123. This migration does NOT close the
-- current disposable-Development anon bridge and therefore cannot lock the
-- current app out. The deny-by-default cutover is migration 006.
-- Production: DO NOT APPLY without a separate Production approval.
--
-- Required order:
--   002 (already live) -> 004 preparation -> 005 CAS hardening -> 006 cutover
--
-- This packet may be applied only after Supabase Google Auth is configured and
-- the intended household owners have signed in at least once. Existing Google
-- subjects are bound to Supabase users through auth.identities.provider_id.
-- If a legacy household has no owner, one already-linked member must explicitly
-- claim it through hearth_claim_legacy_owner before 006 can pass its preflight.

BEGIN;

ALTER TABLE public.continuity_memberships
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.continuity_memberships
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE public.continuity_memberships
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE public.continuity_memberships
  DROP CONSTRAINT IF EXISTS continuity_memberships_role_check;
ALTER TABLE public.continuity_memberships
  ADD CONSTRAINT continuity_memberships_role_check
  CHECK (role IN ('owner', 'member'));

CREATE UNIQUE INDEX IF NOT EXISTS continuity_membership_auth_user
  ON public.continuity_memberships (environment, household_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL AND active AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS continuity_membership_auth_lookup
  ON public.continuity_memberships (auth_user_id, environment)
  WHERE auth_user_id IS NOT NULL AND active AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.household_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  household_id TEXT NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  target_member_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('email', 'qr')),
  invite_token_hash TEXT NOT NULL UNIQUE,
  invited_email TEXT,
  created_by_auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT household_invitations_email_kind CHECK (
    (kind = 'email' AND invited_email IS NOT NULL AND length(trim(invited_email)) > 0)
    OR (kind = 'qr' AND invited_email IS NULL)
  ),
  CONSTRAINT household_invitations_target_membership
    FOREIGN KEY (environment, household_id, target_member_id)
    REFERENCES public.continuity_memberships(environment, household_id, member_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS household_invitations_household
  ON public.household_invitations (environment, household_id, status);
CREATE INDEX IF NOT EXISTS household_invitations_email
  ON public.household_invitations (environment, lower(invited_email))
  WHERE kind = 'email' AND invited_email IS NOT NULL;

ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

-- Bind only exact Google provider subjects. Email is intentionally not an Auth
-- binding because an address may change or be reassigned.
UPDATE public.continuity_memberships AS membership
SET auth_user_id = identity.user_id,
    google_email = lower(coalesce(identity.identity_data ->> 'email', membership.google_email)),
    updated_at = now()::text
FROM auth.identities AS identity
WHERE identity.provider = 'google'
  AND identity.provider_id = membership.google_subject
  AND membership.google_subject <> ''
  AND membership.auth_user_id IS NULL
  AND membership.active IS TRUE
  AND membership.revoked_at IS NULL;

-- Existing households do not contain a trustworthy creator/owner field. The
-- selected owner claims only their own exact bound membership. No arbitrary
-- household/member/user ids can be promoted by this function.
CREATE OR REPLACE FUNCTION public.hearth_claim_legacy_owner(
  p_environment TEXT,
  p_household_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  caller_member_id TEXT;
  existing_owner UUID;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF p_environment NOT IN ('development', 'production') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-environment');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_environment || pg_catalog.chr(31) || p_household_id, 0)
  );

  SELECT member_id INTO caller_member_id
  FROM public.continuity_memberships
  WHERE environment = p_environment
    AND household_id = p_household_id
    AND auth_user_id = caller
    AND active IS TRUE
    AND revoked_at IS NULL
  FOR UPDATE;

  IF caller_member_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-bound-member');
  END IF;

  SELECT auth_user_id INTO existing_owner
  FROM public.continuity_memberships
  WHERE environment = p_environment
    AND household_id = p_household_id
    AND role = 'owner'
    AND active IS TRUE
    AND revoked_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF existing_owner = caller THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'member_id', caller_member_id);
  END IF;
  IF existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner-already-selected');
  END IF;

  UPDATE public.continuity_memberships
  SET role = 'owner', updated_at = now()::text
  WHERE environment = p_environment
    AND household_id = p_household_id
    AND member_id = caller_member_id
    AND auth_user_id = caller;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'member_id', caller_member_id);
END;
$$;

REVOKE ALL ON FUNCTION public.hearth_claim_legacy_owner(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hearth_claim_legacy_owner(text, text) TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (4, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
