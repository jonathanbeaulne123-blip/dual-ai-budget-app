# SF-01 — Baseline reconciliation

**Target AI:** read-heavy verifier  
**Baseline:** exact accepted SF-00 head; rebase onto current `origin/main` if it moved  
**Risk:** High  
**Deltas:** budget `+1`; engagement `0`

## Objective

Produce a machine-readable and human-readable matrix of what is shipped, local-only, disabled, unverified, or absent across identity, membership, continuity, opening truth, imports, Fund, notifications, and financial writes.

## Tasks

1. Trace each capability from UI to command, PGlite, outbox, hosted RPC/table, RLS, and tests.
2. Record the enabling flag, migration state, Development/Production state, owner, proof date, rollback, and stale documentation.
3. Reconcile `CLOUD_CONTINUITY.md`, `AUTH_RLS_CUTOVER.md`, `SYNC_ARCHITECTURE.md`, roadmap, decisions, and current code. Update canon; never use nostalgia/reference as authority.
4. Add a test or lint rule that rejects contradictory claims for D-161, D-162, D-172, and D-174.

## Acceptance

- No “shipped” row lacks code/test/runtime evidence.
- Development and Production are separate columns.
- Unknowns remain unknown; no inferred provider or banking capability.
- All stale statements are corrected with a why-note.

## Proof

Run focused doc/contract tests and `pnpm check`. Disclose all network calls and real-data access. Read-only live checks require explicit scope; do not mutate anything.

## Stop conditions

Stop on baseline drift, ambiguous environment, secret exposure, or conflicting current decisions. Escalate to Jonathan only if the conflict changes product authority.
