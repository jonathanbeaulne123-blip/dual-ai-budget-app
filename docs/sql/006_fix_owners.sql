-- Diagnose + fix "exactly one active owner" before 006.
-- Paste into https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new
-- Run section A first. Only run B if every bad household has exactly one
-- bound active member and zero owners (typical after bind).

-- ── A. Diagnose ─────────────────────────────────────────────────────
SELECT
  household.environment,
  household.id AS household_id,
  household.name,
  count(membership.member_id) AS active_members,
  count(membership.member_id) FILTER (WHERE membership.role = 'owner') AS owner_count,
  count(membership.member_id) FILTER (WHERE membership.auth_user_id IS NOT NULL) AS bound_members
FROM public.households AS household
LEFT JOIN public.continuity_memberships AS membership
  ON membership.environment = household.environment
  AND membership.household_id = household.id
  AND membership.active IS TRUE
  AND membership.revoked_at IS NULL
GROUP BY household.environment, household.id, household.name
ORDER BY household.environment, household.id;

SELECT
  environment, household_id, member_id, role, google_email, auth_user_id IS NOT NULL AS bound
FROM public.continuity_memberships
WHERE active IS TRUE AND revoked_at IS NULL
ORDER BY environment, household_id, member_id;

-- ── B. Promote sole bound member → owner (only where owner_count = 0) ─
-- Safe pattern: household has exactly one active bound member and zero owners.
BEGIN;

UPDATE public.continuity_memberships AS membership
SET role = 'owner',
    updated_at = now()::text
FROM (
  SELECT
    household.environment,
    household.id AS household_id
  FROM public.households AS household
  JOIN public.continuity_memberships AS m
    ON m.environment = household.environment
    AND m.household_id = household.id
    AND m.active IS TRUE
    AND m.revoked_at IS NULL
  GROUP BY household.environment, household.id
  HAVING count(*) FILTER (WHERE m.role = 'owner') = 0
     AND count(*) = 1
     AND count(*) FILTER (WHERE m.auth_user_id IS NOT NULL) = 1
) AS sole
WHERE membership.environment = sole.environment
  AND membership.household_id = sole.household_id
  AND membership.active IS TRUE
  AND membership.revoked_at IS NULL
  AND membership.auth_user_id IS NOT NULL
  AND membership.role <> 'owner';

-- Households with ZERO memberships cannot get an owner this way.
-- Either delete disposable empty Development households, or seed a membership first.
SELECT
  household.environment,
  household.id AS household_id,
  count(membership.member_id) FILTER (WHERE membership.role = 'owner') AS owner_count,
  count(membership.member_id) AS active_members
FROM public.households AS household
LEFT JOIN public.continuity_memberships AS membership
  ON membership.environment = household.environment
  AND membership.household_id = household.id
  AND membership.active IS TRUE
  AND membership.revoked_at IS NULL
GROUP BY household.environment, household.id
HAVING count(membership.member_id) FILTER (WHERE membership.role = 'owner') <> 1;
-- Expect: 0 rows before COMMIT. If any remain, STOP and share the A/B results.

COMMIT;
