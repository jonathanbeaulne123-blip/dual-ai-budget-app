-- TEMPLATE ONLY — do not paste until Jonathan fills every placeholder and approves.
-- Privileged Production owner seed + Personal extract for D-123 path B preflight.
-- Run in the SQL Editor with a role that bypasses RLS (dashboard / service role).
-- Export the Production household JSON on a phone first and keep it local-only.
--
-- After this packet succeeds:
--   1. Apply 008_production_continuity_select.sql if not already applied
--   2. Enable VITE_PRODUCTION_CONTINUITY=1 on a Development/preview build only after export
--   3. Re-run docs/sql/006_preflight_readonly.sql
--   4. Still do NOT apply 006 until Google Auth, owner bind, and rollback rehearsal are green

BEGIN;

-- Replace every <<PLACEHOLDER>> before running.
-- <<HOUSEHOLD_ID>> example: HH-...
-- <<MEMBER_ID>> example: MEM-002
-- <<GOOGLE_SUBJECT>> exact Google provider subject
-- <<GOOGLE_EMAIL>> lower-case email
-- <<DISPLAY_NAME>> member display name
-- <<PERSONAL_PAYLOAD_JSON>> JSON text of that member's Personal envelope
-- <<SHARED_PAYLOAD_JSON>> shared snapshot JSON with Personal txs/shifts/private goals removed
-- <<REVISION>> integer matching the shared snapshot revision
-- <<SNAPSHOT_HASH>> financial audit hash of the shared payload (or recompute client-side later)

INSERT INTO public.continuity_memberships (
  environment, household_id, member_id, google_subject, google_email, display_name, active, updated_at, role
) VALUES (
  'production',
  '<<HOUSEHOLD_ID>>',
  '<<MEMBER_ID>>',
  '<<GOOGLE_SUBJECT>>',
  '<<GOOGLE_EMAIL>>',
  '<<DISPLAY_NAME>>',
  TRUE,
  timezone('utc', now())::text,
  'owner'
)
ON CONFLICT (environment, household_id, member_id) DO UPDATE
SET
  google_subject = EXCLUDED.google_subject,
  google_email = EXCLUDED.google_email,
  display_name = EXCLUDED.display_name,
  active = TRUE,
  role = 'owner',
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.continuity_personal_snapshots (
  environment, household_id, member_id, revision, payload, updated_at
) VALUES (
  'production',
  '<<HOUSEHOLD_ID>>',
  '<<MEMBER_ID>>',
  <<REVISION>>,
  '<<PERSONAL_PAYLOAD_JSON>>',
  timezone('utc', now())::text
)
ON CONFLICT (environment, household_id, member_id) DO UPDATE
SET
  revision = EXCLUDED.revision,
  payload = EXCLUDED.payload,
  updated_at = EXCLUDED.updated_at;

UPDATE public.household_snapshots
SET
  payload = '<<SHARED_PAYLOAD_JSON>>',
  revision = <<REVISION>>,
  snapshot_hash = '<<SNAPSHOT_HASH>>',
  updated_at = timezone('utc', now())::text
WHERE household_id = '<<HOUSEHOLD_ID>>'
  AND environment = 'production';

-- Abort if the shared payload still contains Personal visibility markers.
DO $$
DECLARE
  personal_hits integer;
BEGIN
  SELECT COUNT(*) INTO personal_hits
  FROM public.household_snapshots
  WHERE household_id = '<<HOUSEHOLD_ID>>'
    AND environment = 'production'
    AND (
      payload::text ILIKE '%"visibility":"personal"%'
      OR payload::text ILIKE '%"shared":false%'
    );
  IF personal_hits > 0 THEN
    RAISE EXCEPTION 'Production shared payload still looks Personal-bearing; fix SHARED_PAYLOAD_JSON before commit.';
  END IF;
END $$;

COMMIT;
