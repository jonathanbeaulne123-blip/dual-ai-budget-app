-- 008_production_continuity_select.sql
-- D-123 path B prerequisite: allow SELECT on Production continuity rows so a
-- flagged client can discover seeded memberships without minting them.
--
-- Production: DO NOT APPLY without Jonathan's explicit approval.
-- This does NOT open Production INSERT/UPDATE for anon. Owner membership and
-- Personal extract remain privileged SQL (see docs/sql/008_seed_production_owner_TEMPLATE.sql).
-- Rollback of this file alone:
--   DROP POLICY IF EXISTS continuity_production_select ON public.continuity_memberships;
--   DROP POLICY IF EXISTS continuity_personal_production_select ON public.continuity_personal_snapshots;
--   DELETE FROM public.schema_migrations WHERE id = 8;
--
-- Numbering: Auth cutover remains 006 (unapplied). D-126 timezone is 007 (applied).
-- Rollback packet for 006 is reserved as 009_rollback_006.sql (not this file).

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.continuity_memberships') IS NULL
     OR to_regclass('public.continuity_personal_snapshots') IS NULL THEN
    RAISE EXCEPTION '008 blocked: continuity membership tables from migration 003 are missing.';
  END IF;
END $$;

DROP POLICY IF EXISTS continuity_production_select ON public.continuity_memberships;
CREATE POLICY continuity_production_select ON public.continuity_memberships
  FOR SELECT TO anon, authenticated
  USING (environment = 'production');

DROP POLICY IF EXISTS continuity_personal_production_select ON public.continuity_personal_snapshots;
CREATE POLICY continuity_personal_production_select ON public.continuity_personal_snapshots
  FOR SELECT TO anon, authenticated
  USING (environment = 'production');

INSERT INTO public.schema_migrations (id, applied_at)
VALUES (8, NOW()::text)
ON CONFLICT (id) DO NOTHING;

COMMIT;
