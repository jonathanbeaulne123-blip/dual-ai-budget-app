# Hosted row inventory (do not delete)

The old client could upload demo, empty, and unlinked households because `syncHouseholdBooks` always called `pushSupabaseHousehold({ ...household, linked: true })` on boot and after every commit.

**This file is a runbook, not a cleanup.** Do not delete, overwrite, or inspect hosted row *contents* without Jonathan's explicit approval and a recovery record (D-018 / D-110).

## What may already exist

The bundled project is `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`). RLS is still `USING (true)`. Possible leftover kinds:

- Demo kitchen tables opened from **Open the demo kitchen table**
- Empty Development/Production starts that never tapped Publish
- Hearth Pass joins that were then saved (they used to be marked `linked: true` on assemble)

Do not assume a row is junk from `id` or `name` alone. A real household can share those labels.

## How to list metadata only (Jonathan)

In the Supabase SQL editor, metadata without payload:

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

Local, demo, and unlinked phones make **zero** household REST calls. Invite → **Publish to the cloud** is the only client path that opts a household in. Existing hosted rows stay until Jonathan decides otherwise.
