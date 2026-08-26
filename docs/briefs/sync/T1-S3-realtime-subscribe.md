# T1-S3 — Realtime subscribe

**Tier:** 1  
**Depends on:** T1-S2  
**Blocks:** T1-S4, T1-S5  
**Risk:** Medium (privacy + sync)

## Goal

Add `@supabase/supabase-js` Realtime subscription on `household_snapshots` (and member Personal row if separate channel) so partner writes trigger reconcile within **100–500 ms**. Demote 4 s poll to fallback when Realtime disconnected.

## Baseline

- `src/continuityLivePull.ts` — 4 s REST poll
- `src/App.tsx` — interval reconcile loop
- No Realtime client in tree today

## Allowed scope

- Add supabase-js Realtime channel with RLS-respecting JWT
- Feature flag `VITE_CONTINUITY_REALTIME=1` (Development default after proof)
- On `postgres_changes` INSERT/UPDATE: trigger existing pull/reconcile by household id + revision check
- Poll fallback: keep `livePullIntervalMs` when Realtime status !== SUBSCRIBED
- Migration 014 only if replica identity / publication required — propose, don't apply without approval

## Forbidden

- Bypassing PGlite accept on Realtime payload
- Subscribing before membership resolved
- Full payload merge from websocket without pull/validate path (prefer revision-only trigger → pull)

## Acceptance

- [x] Realtime event triggers reconcile; partner row visible in harness ≤ 500 ms p95 *(measurement deferred to T1-S5; signal path wired)*
- [x] Disconnect → poll fallback within one interval
- [x] Zero household REST for demo/empty/non-member unchanged
- [x] privacy-auditor PASS (channel filters, no cross-household)
- [x] Unit tests for subscribe/unsubscribe lifecycle

## Cursor prompt

```text
Implement T1-S3 from docs/briefs/sync/T1-S3-realtime-subscribe.md.

Add Supabase Realtime subscription for active household snapshot changes. On postgres_changes, trigger the existing reconcile/pull path (revision-gated), do not merge raw websocket payload without PGlite accept. Demote src/continuityLivePull.ts 4s poll to fallback when Realtime disconnected. Gate with VITE_CONTINUITY_REALTIME=1.

Add tests for subscribe lifecycle and fallback. Run pnpm test. privacy-auditor review required. Handoff with latency measurement method and disconnect behavior.
```
