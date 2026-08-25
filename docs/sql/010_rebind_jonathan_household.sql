-- Immediate unblock (dashboard SQL, elevated) — re-bind HH-591c6905afd19707
-- Paste AFTER diagnosing. Prefer migration 010 + kitchen Continue with Google when the
-- client that calls hearth_bind_google_memberships is deployed.
--
-- A. Diagnose
SELECT environment, household_id, member_id, role, google_subject, google_email, auth_user_id
FROM public.continuity_memberships
WHERE household_id = 'HH-591c6905afd19707'
ORDER BY member_id;

SELECT users.id AS auth_user_id, users.email, identities.provider_id AS google_subject
FROM auth.users AS users
LEFT JOIN auth.identities AS identities
  ON identities.user_id = users.id AND identities.provider = 'google'
ORDER BY users.email;

-- B. Re-bind by exact Google provider subject (same rule as migration 004)
UPDATE public.continuity_memberships AS membership
SET auth_user_id = identity.user_id,
    google_email = lower(coalesce(identity.identity_data ->> 'email', membership.google_email)),
    updated_at = now()::text
FROM auth.identities AS identity
WHERE identity.provider = 'google'
  AND identity.provider_id = membership.google_subject
  AND membership.google_subject <> ''
  AND membership.household_id = 'HH-591c6905afd19707'
  AND membership.active IS TRUE
  AND membership.revoked_at IS NULL
  AND (membership.auth_user_id IS NULL OR membership.auth_user_id = identity.user_id);

-- C. If B updated 0 rows: subject empty/mismatched — bind by email to Jonathan's auth user
-- Replace AUTH_USER_UUID with id from section A auth.users row for jonathan.beaulne123@gmail.com
-- UPDATE public.continuity_memberships
-- SET auth_user_id = 'AUTH_USER_UUID'::uuid,
--     google_subject = (SELECT provider_id FROM auth.identities WHERE user_id = 'AUTH_USER_UUID'::uuid AND provider = 'google' LIMIT 1),
--     google_email = 'jonathan.beaulne123@gmail.com',
--     updated_at = now()::text
-- WHERE household_id = 'HH-591c6905afd19707'
--   AND member_id = 'MEM-002'  -- or the owner seat
--   AND active IS TRUE AND revoked_at IS NULL;
