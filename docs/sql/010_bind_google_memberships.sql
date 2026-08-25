-- Migration 010 — bind caller's Google identity to existing continuity memberships.
-- Paste into https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new
-- Required after 006 when Continue with Google returns "not linked" despite an existing
-- household: discovery only matches auth_user_id, and the old "link Google once" path
-- can no longer mint membership rows under deny-by-default RLS.
--
-- Safe: only binds rows whose google_subject matches auth.identities.provider_id,
-- or unbound rows whose google_email matches the caller's Google email.
-- Never steals a row already bound to a different auth.users id.

BEGIN;

CREATE OR REPLACE FUNCTION public.hearth_bind_google_memberships(
  p_environment TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  resolved_google_subject TEXT;
  resolved_google_email TEXT;
  bound_count INTEGER := 0;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF p_environment IS NOT NULL AND p_environment NOT IN ('development', 'production') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-environment');
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

  UPDATE public.continuity_memberships AS membership
  SET auth_user_id = caller,
      google_subject = resolved_google_subject,
      google_email = coalesce(nullif(resolved_google_email, ''), membership.google_email),
      updated_at = now()::text
  WHERE membership.active IS TRUE
    AND membership.revoked_at IS NULL
    AND (p_environment IS NULL OR membership.environment = p_environment)
    AND (membership.auth_user_id IS NULL OR membership.auth_user_id = caller)
    AND (
      (membership.google_subject <> '' AND membership.google_subject = resolved_google_subject)
      OR (
        membership.auth_user_id IS NULL
        AND nullif(resolved_google_email, '') IS NOT NULL
        AND lower(membership.google_email) = resolved_google_email
      )
    );

  GET DIAGNOSTICS bound_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'bound', bound_count,
    'google_subject', resolved_google_subject,
    'google_email', resolved_google_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hearth_bind_google_memberships(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hearth_bind_google_memberships(text) TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (10, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
