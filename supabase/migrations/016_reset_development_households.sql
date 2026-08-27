-- Migration 016 — one-shot Development reset for the signed-in Google member.
-- Applied 2026-08-27 to project tykhocwacaxwquhynkok (Jonathan: paste 016).
-- public.schema_migrations id 16; MCP version 20260827072847 / reset_development_households.
-- Re-apply is idempotent (CREATE OR REPLACE + ON CONFLICT).
-- Deletes every Development household this person owns, and leaves any they
-- only joined as a member. Production households are never touched.

BEGIN;

CREATE OR REPLACE FUNCTION public.hearth_reset_development_households()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := auth.uid();
  deleted_ids TEXT[];
  left_ids TEXT[];
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;

  SELECT coalesce(array_agg(DISTINCT membership.household_id), ARRAY[]::TEXT[])
  INTO deleted_ids
  FROM public.continuity_memberships AS membership
  JOIN public.households AS household
    ON household.id = membership.household_id
   AND household.environment = 'development'
  WHERE membership.environment = 'development'
    AND membership.auth_user_id = caller
    AND membership.role = 'owner'
    AND membership.active IS TRUE
    AND membership.revoked_at IS NULL
    AND hearth_private.is_household_owner(membership.household_id, 'development');

  SELECT coalesce(array_agg(DISTINCT membership.household_id), ARRAY[]::TEXT[])
  INTO left_ids
  FROM public.continuity_memberships AS membership
  JOIN public.households AS household
    ON household.id = membership.household_id
   AND household.environment = 'development'
  WHERE membership.environment = 'development'
    AND membership.auth_user_id = caller
    AND membership.role = 'member'
    AND membership.active IS TRUE
    AND membership.revoked_at IS NULL
    AND NOT (membership.household_id = ANY (deleted_ids));

  IF array_length(deleted_ids, 1) IS NOT NULL THEN
    DELETE FROM public.households
    WHERE environment = 'development'
      AND id = ANY (deleted_ids);
  END IF;

  IF array_length(left_ids, 1) IS NOT NULL THEN
    UPDATE public.continuity_memberships
    SET active = false,
        revoked_at = now(),
        updated_at = now()::text
    WHERE environment = 'development'
      AND auth_user_id = caller
      AND role = 'member'
      AND active IS TRUE
      AND revoked_at IS NULL
      AND household_id = ANY (left_ids);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'mode', 'reset',
    'deleted', to_jsonb(deleted_ids),
    'left', to_jsonb(left_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hearth_reset_development_households() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hearth_reset_development_households() TO authenticated;

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (16, now()::text)
ON CONFLICT (id) DO UPDATE SET applied_at = EXCLUDED.applied_at;

COMMIT;

NOTIFY pgrst, 'reload schema';
