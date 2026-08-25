-- READ-ONLY preflight for D-123 migration 006 (Auth/RLS cutover).
-- Safe to run any time. Does NOT change policies, grants, or rows.
-- Project: tykhocwacaxwquhynkok
-- Paste into https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new and Run.
--
-- Path B (Jonathan 2026-08-25): shared-project cutover approved. Empty Production
-- household deleted; Google Auth identities exist; SELECT bridge 008 applied.
-- 006 Production guard is NOTICE + ceiling 1 (see migration header). Re-run this
-- packet before any paste of 006.

-- ── 1. Migration ledger ─────────────────────────────────────────────
SELECT id, applied_at
FROM public.schema_migrations
ORDER BY id;
-- Expect ids including 2, 4, 5, 7, 8. Must NOT include 6 yet.

-- ── 2. Household inventory ──────────────────────────────────────────
SELECT id, name, environment, timezone, currency, linked, revision, last_committed_at
FROM public.households
ORDER BY environment, id;
-- Expect: 0 Development and 0 Production after empty Production delete
-- (or ≤1 Production under path B ceiling).

-- ── 3. Production membership rows (often EMPTY today) ───────────────
SELECT
  environment,
  household_id,
  member_id,
  role,
  active,
  revoked_at,
  auth_user_id,
  (google_subject <> '') AS has_google_subject,
  google_email
FROM public.continuity_memberships
WHERE environment = 'production'
ORDER BY household_id, member_id;
-- If zero rows with zero households: OK (owner check passes).
-- If households exist with zero memberships: 006 owner preflight FAILS.

-- ── 4. Unbound memberships (project-wide) ───────────────────────────
SELECT count(*) AS unbound_active_memberships
FROM public.continuity_memberships
WHERE active IS TRUE
  AND revoked_at IS NULL
  AND auth_user_id IS NULL;
-- Must be 0 before 006. Binding requires Google Auth + the 004 UPDATE block
-- re-run after owners have signed in at least once (004's bind was one-shot).

-- ── 5. Owner count per household ────────────────────────────────────
SELECT
  household.environment,
  household.id AS household_id,
  count(membership.member_id) FILTER (WHERE membership.role = 'owner') AS owner_count,
  count(membership.member_id) AS active_member_count
FROM public.households AS household
LEFT JOIN public.continuity_memberships AS membership
  ON membership.environment = household.environment
  AND membership.household_id = household.id
  AND membership.active IS TRUE
  AND membership.revoked_at IS NULL
GROUP BY household.environment, household.id
ORDER BY household.environment, household.id;
-- Every household must show owner_count = 1.

-- ── 6. Personal rows still inside shared snapshots ──────────────────
SELECT
  snapshot.environment,
  snapshot.household_id,
  (
    SELECT count(*)
    FROM jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'transactions', '[]'::jsonb)) AS item
    WHERE item ->> 'visibility' = 'personal'
  ) AS personal_txns,
  (
    SELECT count(*)
    FROM jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'shifts', '[]'::jsonb)) AS item
    WHERE item ->> 'visibility' = 'personal'
  ) AS personal_shifts,
  (
    SELECT count(*)
    FROM jsonb_array_elements(coalesce(snapshot.payload::jsonb -> 'goals', '[]'::jsonb)) AS item
    WHERE coalesce((item ->> 'shared')::boolean, true) IS FALSE
  ) AS private_goals
FROM public.household_snapshots AS snapshot
ORDER BY snapshot.environment, snapshot.household_id;
-- All three counts must be 0 before 006. Non-zero on Production means a
-- destructive payload edit is required (export first; decide Personal destination).

-- ── 7. Google Auth identities present? ──────────────────────────────
SELECT
  users.id AS auth_user_id,
  users.email,
  identities.provider,
  identities.provider_id,
  users.created_at
FROM auth.users AS users
LEFT JOIN auth.identities AS identities
  ON identities.user_id = users.id
ORDER BY users.created_at;
-- Empty ⇒ Google provider not used yet. Configure Authentication → Providers → Google,
-- then each intended owner/member must Continue with Google once.

-- ── 8. Snapshot current policies/grants (mandatory before any apply) ─
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- ── Go / no-go summary (human) ──────────────────────────────────────
-- GREEN only if:
--   schema_migrations has 2,4,5,7,8 and not 6
--   unbound_active_memberships = 0
--   every household has owner_count = 1 (zero households is OK)
--   personal_txns = personal_shifts = private_goals = 0 on every snapshot
--   auth.users has the intended Google identities
--   Production household count ≤ 1 (path B ceiling)
-- Otherwise DO NOT paste 006.
-- Rollback rehearsal: docs/sql/009_rollback_006.sql on a disposable clone.
