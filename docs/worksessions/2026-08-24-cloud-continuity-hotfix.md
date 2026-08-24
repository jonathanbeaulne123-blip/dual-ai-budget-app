# 2026-08-24 — Cloud continuity correctness hotfix

**Status:** Complete and pushed to `codex/cloud-continuity-correctness`; not merged, deployed, or applied to any hosted schema.

## Starting point

- Source snapshot: GitHub `main` at `c9a60b41d3c26190b089cc8fe080071399cfca5e`.
- The private repository was downloaded as a ZIP, so this local working directory has no Git history. The verified files were committed atomically to a GitHub branch through the repository connector.
- No household project, hosted database, Production environment, or real household data was contacted.

## Outcome

This slice closes correctness gaps that would make later Google-account continuity unsafe:

- boot reconciliation now uses the same validated write boundary as confirmed commands;
- ingest happens before persistence in normal and auto-merge paths;
- UI success effects only run after an accepted outcome;
- conflict comparison covers complete financial records, goal purchases, and tombstones;
- browser-books inspection verifies the exact acceptance receipt and hash instead of trusting entry counts;
- the living canon now defines Google identity plus cloud-backed personal and household ledgers as the target architecture.

This slice did **not** provide automatic cross-device ledger discovery. Successor D-114 adds the first Development discovery/outbox bridge; the statement here remains the historical boundary of this earlier correctness slice.

## Verification

- `44` test files passed.
- `328` tests passed.
- TypeScript `--noEmit` passed.
- Production bundle completed successfully.

The build emitted existing PGlite/Vite externalization, eval, and chunk-size warnings; it did not fail.

## Decision and risk record

- Decision: D-114 is the active target for continuity. Cloud storage is the durable continuity layer; PGlite remains a per-device validator and offline replica.
- Development data through 2026-09-30 may be disposable and broadly read/write in Dev. Secrets and credentials are never disposable.
- Risk: high, because the affected paths govern money acceptance, conflict handling, recovery, and future synchronization.
- Budget delta: `+2` — better acceptance truth and continuity readiness; no hosted continuity delivered yet.
- Engagement delta: `0` — no user-facing feature was added in this slice.

## Remaining implementation

1. Review and merge `codex/cloud-continuity-correctness`, then continue from an authenticated Git clone for normal local branch workflows.
2. Add Google-subject ledger discovery and household membership records.
3. Add an append-only hosted journal or equivalent versioned cloud authority.
4. Add a durable per-device outbox with idempotent operation identities and automatic replay after sign-in or reconnection.
5. Replace the legacy `linked` transport gate with signed-in membership authorization.
6. Add multi-device, offline, replay, stale-write, and new-device recovery proofs.
7. Prepare—but do not apply without separate approval—the Dev schema/API migration needed by those capabilities.
8. Complete the late-September authentication, RLS, credential rotation, and Production cutover before meaningful October data.

## Next owner

Jonathan reviews the pushed branch. The next engineering slice is identity and membership discovery plus the durable outbox; hosted schema application and deployment remain separate approvals.
