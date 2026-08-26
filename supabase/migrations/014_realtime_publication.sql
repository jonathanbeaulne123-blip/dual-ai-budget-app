-- PROPOSED — T1-S3 Realtime publication (Jonathan approval before apply)
-- Do not run via pnpm books:apply until Development smoke confirms events arrive.
--
-- Supabase Realtime postgres_changes requires tables in supabase_realtime publication.
-- RLS on SELECT still applies to websocket delivery under Auth JWT.
--
-- Rollback (Development only, after approval):
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.household_snapshots;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.continuity_personal_snapshots;
--   DELETE FROM public.schema_migrations WHERE id = 14;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.household_snapshots') IS NULL
     OR to_regclass('public.continuity_personal_snapshots') IS NULL THEN
    RAISE EXCEPTION '014 blocked: snapshot tables from migrations 001/003 are missing.';
  END IF;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.household_snapshots;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.continuity_personal_snapshots;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public.continuity_command_events') IS NOT NULL THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.continuity_command_events;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
