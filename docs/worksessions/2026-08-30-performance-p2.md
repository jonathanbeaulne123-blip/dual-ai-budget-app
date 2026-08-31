# Hearth worksession — Performance P2

- **Status:** CLOSED — merged and deployed; Development canary remains default-off
- **Opened:** 2026-08-30 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/performance-p2`
- **Baseline SHA:** `9376c30ba5db55c920d15ce3feacb65dedae5733`
- **Head SHA:** `29250c73d2af4ca46db97028fd9eaa606fa3aad0`
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development; Production retains full PGlite rebuild

## Household outcome

Confirm yields a Saving frame, accepts balanced books durably on this phone, and lets cloud sharing finish in the background. An explicitly enabled Development canary updates the active PGlite projection incrementally only when an exact trusted v4 SQL receipt exists, with periodic transactional full compaction and no weakening of rollback or audit checks.

## Budget delta (5)

`+5` — the same double-entry, canonical-hash, durable-local, exactly-once boundary becomes fast enough for ordinary daily posting without making network availability part of local acceptance.

## Engagement delta (3)

`+2` — the Saving response is immediate and the kitchen returns promptly while truthful Sharing/Synced state continues in the background. Hercules receives no money authority or new animation work.

## Verified baseline

- `origin/main` and local baseline are `9376c30ba5db55c920d15ce3feacb65dedae5733`; the worktree was clean before this worksession.
- Startup P1 already paints a cached read-only shell, gates Confirm on PGlite validation, moves browser PGlite to a worker, and lazy-loads secondary surfaces.
- Current accepted writes still perform a full transactional `TRUNCATE` projection rebuild and linked ledger writes wait for immediate transport.
- Existing batching bounds inserts at 250 rows and preserves the full rollback/audit path.
- Inference to prove: same-household row deltas plus periodic full compaction will materially reduce warm Confirm latency on household-scale data.

## Scope

### In scope

- Local-first ledger Confirm: balanced PGlite acceptance, durable snapshot, and durable outbox enqueue before UI completion; auth refresh and cloud flush afterward.
- Development-only incremental PGlite projection with exact previous revision/hash precondition, bounded row delta, periodic full compaction, and transactional verification.
- Candidate compile reuse, transfer-pair indexing, worker-open coalescing, consolidated inspection, and privacy-safe timings.
- Deterministic incremental-versus-full equivalence, rollback, worker lifecycle, continuity, and browser performance proof.

### Out of scope

- Production incremental activation, hosted schema, Supabase migrations, secrets, provider changes, Production household data, or deployment.
- Changing financial meaning, command identity, scoped hashes, visible Confirm authority, durable JSON snapshot format, or cloud conflict policy.
- General query caching or removal of the full rebuild/compaction path.

## Acceptance evidence

- [x] Incremental and clean full rebuilds match table-for-table, view-for-view, Fund-table-for-Fund-table, and hash-for-hash through add/update/delete sequences.
- [x] A real trigger-injected failure after reverse deletes and earlier upserts rolls the transaction back to the exact previous projection and receipt.
- [x] Receipt/SQL mismatch fails closed; legacy missing proof, first ingest, household switch, large delta, Production, and periodic compaction use the full rebuild.
- [x] Unresolved/failed network cannot delay or revoke a locally accepted Confirm; a real IDB-or-localStorage outbox pointer is awaited before completion.
- [x] Warm stress-fixture benchmark proves a material relative improvement while retaining canonical SQL proof.
- [x] Focused suites, four-shard repository matrix, typecheck/build, privacy checks, and independent books/continuity audits pass. Physical-device worker/IndexedDB canary proof remains required before enabling the default-off flag.

## Plan

- [x] Add the deterministic projection/delta contract and Development eligibility policy.
- [x] Apply deltas transactionally with post-write accounting/hash verification and audit receipt last.
- [x] Make linked ledger writes local-first and background-flushed.
- [x] Coalesce worker opens, consolidate inspection, reuse compiled work, and add timings.
- [x] Add equivalence/fault/performance tests and run all gates.

## Evidence log

- 2026-08-30: `git fetch origin --prune`; local HEAD and `origin/main` both `9376c30ba5db55c920d15ce3feacb65dedae5733`.
- 2026-08-30: focused P2/Startup/Auth/Fund matrix passed (`66` tests); TypeScript passed.
- 2026-08-30: opt-in 20-write fictional stress benchmark (`1,426` transactions, `176` shifts): incremental p50 `234.1 ms`, p95 `248.3 ms`; full rebuild p50 `417.0 ms`, p95 `462.7 ms` (about `44%` lower median and `46%` lower p95).
- 2026-08-30: four Bash-excluded Vitest shards all exited `0`; the only full-wrapper exception is baseline `test/api.test.ts` requiring unavailable `bash` on Windows (`spawnSync bash ENOENT`).
- 2026-08-30: `pnpm ai:verify`, `tsc --noEmit`, Vite production build, Hercules Pro UI build, no `dist/_redirects`, and `git diff --check` passed. `pnpm check` cannot invoke its Unix `rm -rf dist` wrapper on this host; manual equivalents passed.
- 2026-08-30: independent PGlite and continuity trust re-audits passed with no P0/P1 after projection-digest, durability, Auth, acknowledgement-race, and hidden-rAF repairs.
- 2026-08-30: final verifier caught and rechecked the writer-level Production boundary. An explicit `{ incremental: true }` request now remains full-path in Production; the direct Production and post-delete/upsert rollback proofs passed. Final focused matrix: `84` tests; independent re-verification: PASS.
- 2026-08-30: rebased cleanly onto Shared Money `main@f5f0503`, with SF-02 retained as D-176 and this packet renumbered D-177. The combined release head `29250c7` passed branch CI run `33344886166`, main CI run `33345134140`, Cloudflare deployment run `33345134173`, and live desktop/phone cached-shell validation. The incremental canary remains unset and off.

## Decisions

- Jonathan selected local-save completion, incremental projection depth, and a Development-only canary.
- The canary is feature-off by default and requires `VITE_PGLITE_INCREMENTAL_DEV=1`; Production is hard-disabled.
- v4 receipts bind the canonical key-ordered content of every materialized SQL table. Legacy receipts rebuild once before becoming eligible.
- Incremental eligibility: exact same active household receipt; changed rows no more than `min(1000, max(32, ceil(25% of prior rows)))`; force full compaction before the 64th incremental receipt.
- An incremental SQL or verification failure rejects after transaction rollback. It does not silently rebuild over the problem.

## Remaining uncertainty

- Physical-device warm PGlite and IndexedDB timing has not yet been measured on this branch.
- Actual `PGliteWorker`/Web Locks/IndexedDB reset and interruption behavior is covered structurally and by Node PGlite tests, not by a real-browser canary run.
- Durable full-snapshot persistence may become the next dominant stage after PGlite write reduction; this packet measured but did not redesign it.

## Handoff

Merged to `main` and deployed to `hearth-books` at `29250c7`. No migration, hosted-data mutation, secret change, canary enablement, or Production incremental activation occurred.
