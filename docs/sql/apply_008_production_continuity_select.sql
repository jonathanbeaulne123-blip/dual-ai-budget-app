-- Apply packet: 008_production_continuity_select.sql
-- Jonathan approved apply 2026-08-25.
-- Paste entire file into:
--   https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new
-- Then Run once.
--
-- Source of truth remains:
--   supabase/migrations/008_production_continuity_select.sql
--
-- After apply, verify:
--   SELECT id, applied_at FROM public.schema_migrations WHERE id = 8;
--   SELECT policyname, cmd, qual
--   FROM pg_catalog.pg_policies
--   WHERE tablename IN ('continuity_memberships', 'continuity_personal_snapshots')
--   ORDER BY tablename, policyname;

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
