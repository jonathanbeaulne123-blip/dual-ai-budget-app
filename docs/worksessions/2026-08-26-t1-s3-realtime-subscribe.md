# T1-S3 — Realtime subscribe

**Branch:** `cursor/sync-architecture-c04e`  
**Date:** 2026-08-26  
**Risk:** Medium (privacy + sync)

## Household outcome

When `VITE_CONTINUITY_REALTIME=1`, partner snapshot writes ring the open kitchen via Supabase Realtime within the Tier 1 **100–500 ms** target path. The 4 s REST poll remains fallback when Realtime is not `SUBSCRIBED`.

## Dual Course deltas

- **Budget (5):** `+2` — faster partner visibility without bypassing PGlite accept; poll demoted when push works.
- **Engagement (3):** `+2` — kitchen feels live like a text message when both phones stay open.

## What changed

- `src/continuityRealtime.ts` — Realtime channel on `household_snapshots` + `continuity_personal_snapshots`; revision-only signal → existing `replay()` pull/reconcile.
- `src/App.tsx` — subscribe after `fetchContinuityMembershipRole`; poll skipped when Realtime `SUBSCRIBED`.
- `test/continuity-realtime.test.ts` — lifecycle, fallback, attach guards.
- `supabase/migrations/014_realtime_publication.sql` — **applied** Development (2026-08-26).
- `VITE_CONTINUITY_REALTIME` in `vite-env.d.ts`.

## Verification

```bash
pnpm test test/continuity-realtime.test.ts   # 7/7 pass
pnpm test                                     # 673 pass; 2 pre-existing batch-import-ui SubtleCrypto fails
```

**Privacy-auditor:** PASS (P3 notes: optional environment/member_id filters; lifecycle race fixed with final `live` check).

**Latency measurement method (T1-S5):** Two-browser harness — timestamp Confirm on device A; poll DOM / revision on device B until visible; 10 samples p95 ≤ 500 ms on Development with flag on and Migration 014 applied.

**Disconnect behavior:** Realtime status leaves `SUBSCRIBED` → `shouldUsePollFallback` true → next 4 s interval runs `replay()`. Online/focus/visibility still trigger immediate replay.

## Uncertainty

- Migration **014** — **applied** Development (2026-08-26). Two-phone smoke passed 2026-08-27.
- End-to-end ≤ 500 ms p95 was later measured in T1-S5 / [`SYNC_REALTIME_SMOKE.md`](../SYNC_REALTIME_SMOKE.md).

## Data / environment

- Development client only; feature flag off by default (`VITE_CONTINUITY_REALTIME` unset).
- No Production, secrets, schema apply, or deploy.

## Next owner

014 and the Realtime flag are live on Development. Next work is G6 proof (in-memory 012 harness) and live command-log smoke, not another 014 apply.
