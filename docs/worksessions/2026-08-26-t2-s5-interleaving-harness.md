# T2-S5 handoff — Command-log interleaving harness

- **Status:** OPEN (deterministic harness + tests; not Production claim)
- **Branch:** `cursor/t2-s5-interleaving-harness-7270`
- **Depends on:** T2-S3 materialization + T2-S4 apply path
- **Risk:** High

## Household outcome

Deterministic two-client command-log harness proves Tier 2 interleaving: disjoint shared posts converge to the same cloud hash, same-row edits surface conflicts, personal events stay off the partner's shared books, and offline/duplicate paths rebased safely.

## Dual Course

- **Budget (5):** +2 — convergence proofs before command-log Production claim
- **Engagement (3):** 0

## Scenario table (SYNC_ARCHITECTURE §8 Tier 2)

| Scenario | Tier 2 expectation | Test | Result |
|----------|-------------------|------|--------|
| Disjoint shared txns | event interleave | `disjoint shared posts interleave with stable shared hash` | ✅ hash match |
| Same txn edited both sides | conflict sheet | `same-row diverge records conflict instead of silent LWW` | ✅ unresolved conflict |
| Personal scope isolation | personal events only | `personal scope events stay hidden` + `personal then shared interleave` | ✅ partner clean |
| Duplicate Realtime delivery | idempotent append | `duplicate delivery is idempotent` | ✅ one journal row |
| A offline, B posts, A reconnect | command replay | `long offline client rebases after peer append` | ✅ stale + rebase |
| Reversal vs edit | (T2-S5 brief) | `reversal vs edit keeps journal facts` | ✅ reversal + conflict |
| Clock skew | (T2-S5 brief) | `orders events by result_revision then created_at` | ✅ 2 txns |
| Concurrent same-base race | (harness extra) | `concurrent same-base append rejects loser` | ✅ stale-revision |

Deferred to other slices: latency (T1-S5 Playwright), Realtime down (T1-S3), wrong Google subject (D-146), confirmation-scoped undo (T2-S6).

## Files

| File | Change |
|------|--------|
| `src/ledger/continuityCommandLogHarness.ts` | In-memory append CAS, materialize, member-scoped catch-up |
| `test/continuity-command-interleaving.test.ts` | 9 scenario tests |

## Verification

```text
pnpm exec vitest run test/continuity-command-interleaving.test.ts
→ 9/9 passed
pnpm exec vitest run test/materialize-snapshot-from-events.test.ts test/continuity-command-realtime.test.ts test/hosted-cas-two-client.test.ts
→ 22/22 passed
```

Books-auditor blocking issue (partner catch-up personal leak on fallback) fixed via member-scoped materialize + revision advance on skipped personal events.

## Next owner

**T2-S6:** confirmation-scoped undo + D-124 restore rebase rules.
