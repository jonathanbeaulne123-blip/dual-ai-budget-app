-- DO NOT APPLY without Jonathan's explicit approval.
-- Auth + membership RLS cutover packet (proposed D-123).
-- Product choices are open in docs/AUTH_RLS_CUTOVER.md (Q1–Q5).
-- Do not paste into the household Supabase SQL editor from an AI session.
-- Do not contact the household project. GPT owns live 002 apply/smoke on a
-- separate runway; this packet must not be mixed into that apply.
--
-- Order (when approved):
--   001_hearth_books.sql (applied)
--   003_continuity_membership.sql (applied)
--   002_snapshot_cas.sql (CAS; separate approval / apply)
--   004_auth_rls_cutover.sql (this file — Auth/RLS)
--
-- Rollback sketch (after a future apply): restore open Development policies only
-- under Jonathan's recovery plan; never improvise from an AI session.
--
-- This stub intentionally contains NO executable policy changes until Q1–Q5
-- are answered. The statements below are documentation of the intended spine.

BEGIN;

-- Intended spine (commented until product answers land):
--
-- ALTER TABLE continuity_memberships
--   ADD COLUMN IF NOT EXISTS auth_user_id UUID;
-- CREATE UNIQUE INDEX IF NOT EXISTS continuity_membership_auth_user
--   ON continuity_memberships (environment, household_id, auth_user_id)
--   WHERE auth_user_id IS NOT NULL AND active;
--
-- Map auth.uid() to membership (Q1 decides how auth_user_id is populated).
-- Replace hearth_anon_all / continuity_development_open with deny-by-default
-- policies for authenticated members only (see docs/AUTH_RLS_CUTOVER.md matrix).
-- REVOKE ALL on households, household_snapshots, continuity_* FROM anon.
-- REVOKE DELETE on those tables FROM authenticated.
-- Restrict EXECUTE on publish_household_snapshot to authenticated members.
--
-- Invitation / role columns depend on Q2 and Q3.

SELECT 1; -- no-op placeholder so the file is a valid transaction packet

COMMIT;
