# SF-05 — Fail-closed acceptance audit

**Target AI:** independent verifier; not the primary SF-02–SF-04 writer
**Baseline:** exact candidate Phase 0 head
**Risk:** Release
**Deltas:** budget `+1`; engagement `0`

## Objective

Prove that Phase 0 fails closed under identity, privacy, continuity, ledger, offline, and recovery attacks before any Shared Money Inbox work begins.

## Adversarial matrix

Test at minimum: anonymous access; wrong subject; wrong household; expired/replayed invite; member/device revoke; queued write after revoke; simultaneous commands; duplicate/reordered events; corrupted snapshot; stale hash; partial Shared/Personal failure; offline recovery; cross-environment identifier; private export/AI/alert leakage; opening-entry replay; reversal; browser refresh at every confirmation boundary.

## Required proof

- Exact SHA and clean diff.
- Focused unit/integration/property tests and full `pnpm check`.
- Two-browser Development smoke with synthetic identities/data.
- RLS/REST denial evidence without secrets in logs.
- Visual, keyboard, screen-reader naming, reduced-motion, and 390/720/1100 px proof for new UI.
- Network/data/MCP/schema/secret/environment disclosure.
- Independent books and privacy verdict with all P0–P2 findings closed or explicitly blocking.

## Exit rule

Phase 0 passes only when every critical scenario is green and the canonical baseline matrix agrees with code and runtime evidence. Flakes are failures until reproduced and classified. Missing tools are environment conditions, not green tests.

## Forbidden actions

No Production mutation, real-money test, partner activation, secret change, deployment, merge, or push without Jonathan's explicit authorization. The verifier must not repair findings in the same checkout; return them to the implementation owner.
