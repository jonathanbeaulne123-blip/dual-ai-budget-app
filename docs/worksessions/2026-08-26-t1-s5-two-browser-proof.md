# Worksession — T1-S5 two-browser proof

**Date:** 2026-08-26  
**Branch:** `cursor/t1-s5-two-browser-proof-7270`  
**Depends on:** T1-S4 merged (#177)

## Household outcome

Tier 1 gate **G4** evidence: two-client harness proves partner visibility, offline outbox convergence, stale CAS conflict, and duplicate Realtime idempotency on disposable Development fixtures.

## What changed

| File | Change |
|---|---|
| `src/continuityTwoClientHarness.ts` | Two-client sync harness + latency stats + fault helpers |
| `test/continuity-two-browser-proof.test.ts` | 8 proof tests including 10-sample p95 run |
| `/opt/cursor/artifacts/t1-s5-latency-evidence.json` | Recorded latency evidence from CI/harness |

## Latency table (harness run)

Evidence file written by test `measures 10 samples with p95 ≤ 500 ms`. Network: **in-memory Vitest** (simulates Realtime → coordinator pull; no WAN). Re-run:

```bash
pnpm exec vitest run test/continuity-two-browser-proof.test.ts
cat /opt/cursor/artifacts/t1-s5-latency-evidence.json
```

Target: **p95 ≤ 500 ms**. Harness passes with in-memory timings (typically single-digit ms).

## Fault scenario matrix

| Scenario | Result |
|---|---|
| A posts → B visible (10 samples, p95) | PASS |
| Offline A outbox → reconnect flush | PASS |
| Stale CAS → conflict, hosted preserved | PASS |
| Duplicate Realtime on B | PASS (1 row) |
| Concurrent Realtime pulls | PASS (serialized, 1 row) |

## Verification

- `pnpm exec vitest run test/continuity-two-browser-proof.test.ts test/hosted-cas-two-client.test.ts test/continuity-coordinator.test.ts`
- `pnpm check`

## Dual Course deltas

- **Budget (5):** `+2` — deterministic Tier 1 proof before Tier 2 command-log merge.
- **Engagement (3):** `+1` — partner visibility gate documented with evidence.

## Uncertainty

- Harness is in-memory, not Playwright against live Supabase Realtime. Jonathan two-phone manual smoke on deployed Dev remains complementary evidence for WAN latency.

## Next owner

Jonathan — merge PR; T1-S6 sync freshness UI; optional manual two-phone timestamp log on Dev kitchen.
