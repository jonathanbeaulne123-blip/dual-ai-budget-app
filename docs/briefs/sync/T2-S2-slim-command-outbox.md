# T2-S2 — Slim command outbox

**Tier:** 2  
**Depends on:** T2-S1  
**Risk:** High

## Goal

Outbox stores command receipt refs (confirmation_id, idempotency_key, base_revision) — not full household journal. Flush calls append RPC + optional snapshot compact.

## Allowed scope

- Extend D-145 outbox schema with migration path from snapshot tips
- Backward read of legacy outbox items until drained

## Forbidden

- Storing full journal in IndexedDB outbox body
- Skipping `hearth_create_household` on the first hosted write (`expectedRevision === 0`)

## Acceptance

- [ ] New enqueues are ref-only
- [ ] Legacy items flush correctly
- [ ] localStorage quota tests with large household
- [ ] First flush (`expectedRevision === 0`) still calls `hearth_create_household` — command-log append requires an existing owner membership

## Cursor prompt

```text
Implement T2-S2 from docs/briefs/sync/T2-S2-slim-command-outbox.md.

Change continuity outbox to store command receipt references instead of full snapshots for new items. Migrate flush path to append_continuity_command (T2-S1). Preserve legacy snapshot outbox drain. Run pnpm test. Handoff with outbox schema before/after.
```
