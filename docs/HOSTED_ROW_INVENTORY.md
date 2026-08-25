# Hosted row inventory and approved cleanup record

The old implicit upload path (`syncHouseholdBooks` forced `linked: true` on boot, including demo, empty, and unlinked households) left disposable Development rows in the shared Supabase project.

**Cleanup completed 2026-08-24 with Jonathan's explicit approval and action-time confirmation.** A guarded transaction required exactly 30 Development households and exactly one Production household before deleting only `environment = 'development'`. Verification after commit returned:

- 0 Development households;
- 0 continuity memberships;
- 0 continuity Personal snapshots;
- 1 Production household, untouched;
- applied migration ids including `[2,4,5,7]` (007 = D-126 timezone CHECK, 2026-08-25).

No payload contents or household identifiers are stored in this document. Do not delete or edit the remaining Production household without a new explicit approval.

## What was removed

- Development demo catalog snapshots uploaded by the old boot path.
- Empty Development households uploaded on first open.
- Development unlinked copies rewritten to `linked: true` by old transport.
- Development duplicates and old Hearth Pass joins.

The deletion decision was environment-wide because Jonathan declared legacy Development households disposable; it was not inferred from an id or name.

## What this record does not authorize

- Any Production row change.
- Applying project-wide migration 006.
- Enabling providers, changing secrets, deploying, or merging.
- Future blanket cleanup of Development rows created after this event.

## Jonathan decisions still required

1. Choose a separate Development Supabase project or explicitly approve a full shared-project cutover.
2. Configure the Google provider and prove signed-in Create, Join, invite, revoke, and reconnect behavior.
3. Apply migration 006 only after that project-boundary decision and a clean preflight.

## Metadata-only verification query

The bundled project is `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`). RLS remains open until 006. In the Supabase SQL editor, list metadata without payload:

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

Do **not** `SELECT payload`. Do **not** delete the remaining Production row.

## After D-110

Local, demo, unlinked, and Hearth Pass phones make **zero** household REST calls. New disposable Development rows may be recreated during testing; this cleanup does not authorize deleting them automatically.
