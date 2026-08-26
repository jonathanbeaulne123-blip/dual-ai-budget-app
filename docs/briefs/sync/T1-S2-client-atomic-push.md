# T1-S2 — Client atomic push

**Tier:** 1  
**Depends on:** T1-S1 applied Development  
**Blocks:** T1-S3  
**Risk:** High (money transport)

## Goal

Replace sequential Shared-then-Personal push in `pushSupabaseHousehold` with single `publish_continuity_snapshot` RPC for Auth continuity paths. Remove two-trip partial-failure window.

## Baseline

- `src/ledger/supabase.ts` — sequential CAS + Personal POST
- `src/ledger/snapshotCas.ts` — pure CAS contract
- D-147 refuse-legacy when RPC missing

## Allowed scope

- Wire client to 012 RPC; map responses to existing `{ pushed, conflict, skipped }` shapes
- Update `test/supabase.test.ts`, hosted-cas tests
- Feature-detect: if 012 missing, fail closed for Auth continuity (keep D-147 behavior)

## Forbidden

- Re-enabling GET-compare-POST for Auth continuity
- Ack outbox on partial success
- Production enable without flag

## Acceptance

- [ ] Auth continuity uses one network round trip
- [ ] Personal fail after Shared impossible (atomic)
- [ ] Legacy Advanced recovery path unchanged for Auth-off
- [ ] All supabase/hosted-cas tests green
- [ ] books-auditor PASS

## Cursor prompt

```text
Implement T1-S2 from docs/briefs/sync/T1-S2-client-atomic-push.md.

Wire src/ledger/supabase.ts to call publish_continuity_snapshot (Migration 012) for Auth continuity pushes instead of sequential Shared CAS + Personal POST. Preserve D-147 fail-closed when RPC missing on Auth paths. Keep legacy Advanced recovery for Auth-off only.

Update tests in test/supabase.test.ts and test/hosted-cas-two-client.test.ts. Run pnpm test. Do not enable Realtime yet. Handoff with before/after transport diagram and test output.
```
