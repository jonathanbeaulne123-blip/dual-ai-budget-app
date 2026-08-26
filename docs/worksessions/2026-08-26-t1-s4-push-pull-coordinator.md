# Worksession — T1-S4 push/pull race coordinator

**Date:** 2026-08-26  
**Branch:** `cursor/t1-s4-push-pull-coordinator-7270`  
**Risk:** High — lost update / duplicate merge if wrong.

## Household outcome

Outbox flush, Realtime signals, poll fallback, and focus/online replay no longer run concurrently or double-merge the same hosted revision.

## What changed

| File | Change |
|---|---|
| `src/continuityCoordinator.ts` | Mutex queue, stale-signal guard, 100 ms pull/accept dedupe |
| `src/App.tsx` | Live continuity loop uses `scheduleReplay(source)` instead of drop-on-busy `running` flag |
| `test/continuity-coordinator.test.ts` | 12 deterministic race tests |

## Race scenario matrix

| Scenario | Expected | Test |
|---|---|---|
| Realtime during flush | Serial execution, max overlap 1 | `Realtime during flush` |
| Flush during pull | One accept per revision | `flush during pull` |
| Duplicate Realtime events | Stale rev ignored; dedupe fresh | `duplicate Realtime events` |
| Stale signal (remote ≤ local tip) | Skip merge | `shouldIgnoreInboundSnapshot` |
| Open conflict | Do not ignore inbound | `open conflict` |
| Concurrent poll + Realtime | Queued, not dropped | `serializes concurrent runs` |

## Verification

- `pnpm exec vitest run test/continuity-coordinator.test.ts test/continuity-realtime.test.ts test/live-pull-dual-use.test.ts` — 28/28
- `pnpm check` — 737 pass; build green after TS fix

## Dual Course deltas

- **Budget (5):** `+2` — no silent LWW or duplicate PGlite accept under concurrent sync.
- **Engagement (3):** `+1` — partner posts stay reliable while Realtime is primary.

## Next owner

Jonathan — merge PR; T1-S5 two-browser p95 proof; T1-S6 freshness UI.
