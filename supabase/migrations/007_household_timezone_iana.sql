-- D-126: allow any non-empty IANA household timezone on hosted Development.
-- DO NOT APPLY without Jonathan's explicit approval (Q8 A).
-- Local PGlite already relaxes this in BOOKS_SCHEMA_VERSION 2.
--
-- Numbering: Auth preparation already owns schema_migrations id 4
-- (`004_auth_rls_prepare.sql`). This packet is id 7 so apply tooling and
-- history never collide with the Auth 004 file that shared the old name
-- `004_household_timezone_iana.sql`.
-- Production: DO NOT APPLY without a separate Jonathan approval.
--
-- Apply: SUPABASE_DB_PASSWORD=… pnpm books:apply:007
--    or paste into the project SQL editor and Run.
-- Rollback:
--   ALTER TABLE households DROP CONSTRAINT IF EXISTS households_timezone_nonempty;
--   ALTER TABLE households ADD CONSTRAINT households_timezone_check CHECK (timezone = 'America/Toronto');
--   DELETE FROM schema_migrations WHERE id = 7;

BEGIN;

ALTER TABLE households DROP CONSTRAINT IF EXISTS households_timezone_check;
ALTER TABLE households DROP CONSTRAINT IF EXISTS households_timezone_nonempty;
ALTER TABLE households
  ADD CONSTRAINT households_timezone_nonempty CHECK (char_length(timezone) > 0);

INSERT INTO schema_migrations (id, applied_at)
VALUES (7, NOW()::text)
ON CONFLICT (id) DO NOTHING;

COMMIT;
