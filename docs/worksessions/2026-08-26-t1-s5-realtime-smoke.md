# Hearth worksession — T1 Realtime two-phone smoke (D-149 G4)

- **Status:** CLOSED — Jonathan live pass 2026-08-27
- **Owner:** Jonathan
- **Decision:** D-149 Tier 1 gate G4
- **Runbook:** [`SYNC_REALTIME_SMOKE.md`](../SYNC_REALTIME_SMOKE.md)

## Household outcome

When Bianca confirms on her phone, Jonathan’s open kitchen shows the shared row via Realtime within **≤500 ms p95** — not after the 4 s poll.

## Evidence

| Item | Result |
|---|---|
| Migration 014 | Applied (publication on snapshot tables) |
| Two-phone Realtime smoke | **Passed** |
| Distinct from D-150 | Invite/discovery smoke passed 2026-08-26 separately |

## Remaining before Tier 2

- G6 trust + books auditor on Tier 1 slices
- T1-S6 sync freshness UI (optional polish)
- Rebase and merge T2-S1 (Migration 013) — not the full T2 stack at once
