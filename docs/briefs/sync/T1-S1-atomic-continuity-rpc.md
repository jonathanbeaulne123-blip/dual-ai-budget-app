# T1-S1 — Atomic continuity RPC (Migration 012)

**Tier:** 1 — Push-native continuity  
**Depends on:** Migration 002 CAS live; pattern from `011_hercules_pro_confirmed_write.sql`  
**Blocks:** T1-S2, all Realtime work  
**Risk:** High (money + hosted schema)

## Goal

One SQL transaction atomically: (1) CAS-advance shared `household_snapshots`, (2) upsert member Personal envelope, (3) touch membership metadata if needed, (4) return unified `{ ok, revision, reason }`. Eliminate “Shared succeeded, Personal failed” split state.

## Baseline

- `publish_household_snapshot` (002) — Shared only
- `publish_hercules_pro_confirmed_write` (011) — Shared+Personal prototype, not applied
- D-147: client treats Personal fail after Shared as pending

## Allowed scope

- Author `supabase/migrations/012_publish_continuity_snapshot.sql`
- Reuse `hearth_private.payload_is_shared`, advisory lock, environment guard
- pgTAP or SQL tests: create, duplicate idempotent, stale revision, environment mismatch, not-member
- Update `docs/SYNC_ARCHITECTURE.md` migration table only if signature changes
- Proposal doc in PR; **do not apply Production**

## Forbidden

- Service role in browser; `VITE_` secrets
- Populating normalized journal tables
- Weakening 006 RLS
- Applying migration without Jonathan Development approval

## Acceptance

- [ ] Single RPC accepts Shared+Personal in one TX; rollback on any failure
- [ ] Stale `expected_revision` returns conflict without partial write
- [ ] Duplicate idempotency (same confirmation id) returns success without double revision bump
- [ ] Development-only guard until October packet
- [ ] Trust + books auditor PASS
- [ ] Migration rollback SQL in file header

## Cursor prompt

```text
Implement T1-S1 from docs/briefs/sync/T1-S1-atomic-continuity-rpc.md.

Create supabase/migrations/012_publish_continuity_snapshot.sql: one SECURITY DEFINER RPC that atomically CAS-advances household_snapshots and upserts continuity_personal_snapshots for the authenticated member, following the transaction skeleton in 011_hercules_pro_confirmed_write.sql and guards from 002_snapshot_cas.sql.

Add SQL/pgTAP tests for success, stale revision, environment mismatch, not-member, and idempotent duplicate. Do not apply to Production. Do not change client push yet (T1-S2). Run pnpm test. Return handoff with migration diff summary and auditor notes.
```
