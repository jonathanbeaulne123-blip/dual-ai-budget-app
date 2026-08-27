# G6 Trust Review — D-149 Tier 1 (T1-S1…T1-S5)

**Date:** 2026-08-27  
**Baseline:** `4efe6dc` (pre-T1-S1) → `main`  
**Risk:** High — hosted money transport + Realtime boundaries  
**Status:** **CONDITIONAL PASS → Tier 1 proof gaps closed in code** (2026-08-27 follow-up). P0 remediated earlier; P1 harness proof landed on branch `cursor/g6-tier1-proof-gaps-403c`.

## Household outcome

Independent trust + books auditors reviewed Tier 1 push-native continuity before T2 starts. One blocking transport defect (gzip personal envelope vs Migration 012 SQL) was found and fixed; proof harness gaps remain documented.

## Auditor verdicts

| Auditor | Initial verdict | After P0 fix |
|---|---|---|
| **hearth-trust-auditor** | **FAIL** — P0 gzip personal payload breaks 012 | **PASS WITH NOTES** (P1 proof + Realtime JWT re-attach) |
| **books-auditor** | **PASS WITH NOTES** | **PASS WITH NOTES** (unchanged) |

## P0 — remediated (2026-08-27)

**Gzip personal envelope rejected by `payload_is_member_personal`.**

- **Cause:** `publishContinuitySnapshotAtomic` used `encodeHouseholdPayload`, which gzip-wraps payloads >2 KB. Migration 012 inspects plain JSON for `kind=personal` and `memberId`.
- **Fix:** `encodePersonalEnvelopePayload` (always plain JSON); atomic publish path uses it.
- **Tests:** `test/snapshot-payload.test.ts`, `test/auth-membership-authority.test.ts` (large personal canary).

## P1 — remediated (2026-08-27 follow-up)

| ID | Finding | Remediation |
|---|---|---|
| P1-1 | Migration 012 tests static SQL regex only | `test/continuity-cas-harness.test.ts` + `pnpm books:smoke:012` (JWT-gated live smoke) |
| P1-2 | T1-S5 harness stubbed legacy `publish_household_snapshot` | `src/ledger/continuityCasHarness.ts` + Auth config in T1-S5 harness |
| P1-3 | T1-S5 inbound reconcile skipped `acceptHouseholdWrite` | `applyRealtimePullOnB` now mirrors prod pull accept path |
| P1-4 | Realtime Production guard added (`continuityRealtimeAllowed`); confirm 008 policy state on Dev project | Jonathan / Engineering (unchanged) |

## P2 — follow-ups (not blocking T2 planning)

- Wire `p_confirmation_id` / `p_identity_hash` on outbox flush
- Realtime JWT re-attach after channel error / expiry (T1-S6 honest chrome)
- T1-S4 race matrix vs test enumeration gap
- Sync UI “synced” while outbox pending (pre-existing G5 edge)

## Tier 1 gate matrix (post-review)

| Gate | Status |
|---|---|
| G1 Atomic publish (012) | ✅ Applied Dev |
| G2 Realtime wired | ✅ |
| G3 Poll demoted | ✅ |
| G4 Two-browser latency | ✅ Jonathan manual 2026-08-27 |
| G5 No ack lie | ✅ |
| G6 Trust review | ✅ **PASS WITH NOTES** — P0 fixed; P1 harness proof in repo; P1-4 / P2 follow-ups remain |

## Dual Course

- **Budget (5):** +4 — atomic CAS, coordinator dedupe, P0 fix restores reachable Auth publish for growing households
- **Engagement (3):** +2 — Realtime path validated; Production Realtime boundary aligned with 012

## Verification

```text
pnpm exec vitest run test/continuity-cas-harness.test.ts test/continuity-two-browser-proof.test.ts test/auth-membership-authority.test.ts
pnpm test
SUPABASE_ACCESS_TOKEN=<jwt> pnpm books:smoke:012
```

## Next owner

1. Merge G6 remediation branch (P0 + Production Realtime guard).
2. Optional: T1-S6 freshness UI.
3. Rebase T2-S1 onto `main` after Jonathan applies Migration 013 — do not merge full T2 stack until Tier 1 proof gaps close.
