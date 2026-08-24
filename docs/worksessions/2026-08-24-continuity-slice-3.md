# 2026-08-24 — Continuity slice 3: device replicas

**Status:** Implemented and pushed to PR #72 on `codex/cloud-continuity-correctness`. No hosted schema, hosted rows, Production deployment, credentials, or secrets were changed.

## Delivered

- Household snapshots are stored by `environment + householdId`, with a local catalog and active pointer.
- The active header exposes a ledger switcher when more than one replica is present.
- Sessions remember the active household id; switching chooses the matching member when possible and re-ingests that household into PGlite before display.
- Existing `hearth:v1:<environment>` snapshots migrate automatically and remain available as a compatibility copy for the active ledger.
- Reset deletes only the selected household and its known personal replicas, then leaves any other local ledger readable.
- Every signed-in member gets a durable personal envelope at `environment + householdId + memberId`; it contains only that member's personal transactions and shifts.
- Personal view reads the member replica. Full-snapshot synchronization intentionally retains its prior lossless envelope semantics so another member's personal facts are not dropped during reconciliation.
- PGlite holds the active household's compiled books per environment. Switching transactionally replaces the prior active rows, preventing household-local ids such as `MEM-001` from colliding while inactive snapshots remain durable in the replica store.

## Proof

- New storage tests cover legacy migration, two-household persistence and switching, member-personal isolation, selected-ledger reset, and session reload.
- Existing visibility and sync-integrity proofs remain green, including preservation of a partner's personal rows during full-snapshot reconciliation.
- Full serial suite: `46` files, `340` tests passed. TypeScript `--noEmit` and the production Vite bundle passed; the bundle retains the existing PGlite browser-external, eval, and chunk-size warnings.

## Honest boundary

This slice creates device replica scopes. It does **not** create hosted personal-ledger rows, hosted membership records, server-side discovery, atomic hosted CAS/journal authority, backoff/acknowledgement, or the late-September Auth/RLS cutover. No peer device is needed after an accepted snapshot reaches the existing Development cloud bridge.

## Dual Course

- Budget delta (5): `+1` over the D-114 open bridge — switching or opening another membership no longer overwrites a different local ledger.
- Engagement delta (3): `0` — this is continuity infrastructure; Hercules and Office chrome are unchanged apart from the ledger selector.
