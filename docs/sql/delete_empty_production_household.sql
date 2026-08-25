-- Delete the empty Production household (Jonathan 2026-08-25: no useful data).
-- Paste into https://supabase.com/dashboard/project/tykhocwacaxwquhynkok/sql/new
--
-- Target: HH-9465baf2ec6c9d9d / environment = production
-- Cascades: household_snapshots, continuity_*, journal_*, members, etc.

-- ── A. Verify before delete (run alone first) ───────────────────────
SELECT id, name, environment, linked, revision, last_committed_at
FROM public.households
WHERE id = 'HH-9465baf2ec6c9d9d';

SELECT environment, household_id, count(*) AS membership_rows
FROM public.continuity_memberships
WHERE household_id = 'HH-9465baf2ec6c9d9d'
GROUP BY environment, household_id;

SELECT environment, household_id, revision
FROM public.household_snapshots
WHERE household_id = 'HH-9465baf2ec6c9d9d';

-- ── B. Delete (run only after A shows that Production row) ───────────
BEGIN;

DO $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.households
  WHERE id = 'HH-9465baf2ec6c9d9d'
    AND environment = 'production';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 1 THEN
    RAISE EXCEPTION 'Expected to delete 1 Production household, deleted %', deleted_count;
  END IF;
END $$;

COMMIT;

-- ── C. Verify after delete ──────────────────────────────────────────
SELECT count(*) AS production_households
FROM public.households
WHERE environment = 'production';
-- Expect: 0

SELECT count(*) AS leftover_snapshots
FROM public.household_snapshots
WHERE household_id = 'HH-9465baf2ec6c9d9d';
-- Expect: 0
