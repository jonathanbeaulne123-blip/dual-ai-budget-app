# Hosted row inventory (do not delete)

The household Supabase project is off-limits to AI access. This file is an inventory of *possible* leftover hosted rows from the old implicit upload path (`syncHouseholdBooks` forced `linked: true` on boot, including demo / empty / unlinked households).

**This is a runbook, not a cleanup.** Do not delete, overwrite, or inspect hosted row *contents* without Jonathan's explicit approval and a recovery record (D-018 / D-110).

## What may exist

- Demo `catalogHousehold` snapshots uploaded because boot always published.
- Empty development households uploaded on first open.
- Unlinked kitchen copies that were rewritten to `linked: true` by transport.
- Duplicate snapshots for the same invite phrase if a phone published after a silent boot upload.
- Hearth Pass joins that were then saved (they used to be marked `linked: true` on assemble)

Do not assume a row is junk from `id` or `name` alone. A real household can share those labels.

## What this file does not do

- It does not read the household project from an AI session.
- It does not delete rows.
- It does not apply SQL.

## Jonathan decisions required

1. Inventory live `households` / `household_snapshots` on the household project (human or approved operator, not an AI session).
2. Keep or delete leftover demo/unlinked rows **only** after a recovery record exists.
3. Apply `supabase/migrations/002_snapshot_cas.sql` only after reviewing residual last-writer race.
4. Do not apply Auth/RLS until Auth users exist (see `docs/sql/rls_auth_ready.sql`).

## How to list metadata only (Jonathan)

The bundled project is `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`). RLS is still `USING (true)`. In the Supabase SQL editor, metadata without payload:

```sql
SELECT
  h.id,
  h.name,
  h.environment,
  h.invite_phrase,
  h.linked,
  h.revision,
  h.last_committed_at,
  s.updated_at AS snapshot_updated_at,
  octet_length(s.payload::text) AS payload_bytes
FROM public.households h
LEFT JOIN public.household_snapshots s ON s.household_id = h.id
ORDER BY s.updated_at DESC NULLS LAST;
```

Do **not** `SELECT payload`. Do **not** `DELETE`. Copy the result into a recovery note if a cleanup is later approved.

## After D-110

Local, demo, unlinked, and Hearth Pass phones make **zero** household REST calls. Invite → **Publish to the cloud** is the only client path that opts a household in. Existing hosted rows stay until Jonathan decides otherwise.
