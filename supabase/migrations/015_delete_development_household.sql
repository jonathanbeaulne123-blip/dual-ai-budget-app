-- Migration 015 — Development-only household delete / member leave for testing cleanup.
-- Paste into Supabase SQL Editor after Jonathan approves Development mutation.
-- Production households are never deleted through this RPC.

BEGIN;

CREATE OR REPLACE FUNCTION public.hearth_leave_household(
  p_environment TEXT,
  p_household_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF p_environment NOT IN ('development', 'production') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad-environment');
  END IF;
  UPDATE public.continuity_memberships
  SET active = false, revoked_at = now(), updated_at = now()::text
  WHERE environment = p_environment
    AND household_id = p_household_id
    AND auth_user_id = caller
    AND active IS TRUE
    AND revoked_at IS NULL
    AND role = 'member';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-member');
  END IF;
  RETURN jsonb_build_object('ok', true, 'mode', 'leave');
END;
$$;

CREATE OR REPLACE FUNCTION public.hearth_delete_development_household(
  p_household_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  target_env TEXT;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  SELECT environment INTO target_env
  FROM public.households
  WHERE id = p_household_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found');
  END IF;
  IF target_env IS DISTINCT FROM 'development' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'production-blocked');
  END IF;
  IF NOT hearth_private.is_household_owner(p_household_id, 'development') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-owner');
  END IF;
  DELETE FROM public.households WHERE id = p_household_id AND environment = 'development';
  RETURN jsonb_build_object('ok', true, 'mode', 'delete', 'household_id', p_household_id);
END;
$$;

REVOKE ALL ON FUNCTION public.hearth_leave_household(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hearth_delete_development_household(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hearth_leave_household(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hearth_delete_development_household(text) TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (15, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
