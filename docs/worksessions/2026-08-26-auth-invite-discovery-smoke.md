# Hearth worksession — Auth QR invite discovery smoke (D-150)

- **Status:** CLOSED — Jonathan live pass 2026-08-26
- **Owner:** Jonathan
- **Decision:** D-150 (merged #180); cleanup #181 + migration 015
- **Runbook:** [`AUTH_INVITE_SMOKE.md`](../AUTH_INVITE_SMOKE.md)

## Household outcome

Partner QR invite → Google sign-in → redeem → immediate discovery → open household works on the live Development kitchen without snapshot `google.links` lag blocking discovery.

## Evidence

| Item | Result |
|---|---|
| Migration 015 | Pasted; `Success. No rows returned` |
| Test cleanup | Delete household buttons used before smoke |
| Two-device QR smoke | **Passed** |
| PRs | #180 (discovery), #181 (delete/leave) |

## Out of scope for this smoke

D-149 Tier 1 Realtime latency proof (100–500 ms partner visibility) — separate checklist in [`SYNC_ARCHITECTURE.md`](../SYNC_ARCHITECTURE.md).
