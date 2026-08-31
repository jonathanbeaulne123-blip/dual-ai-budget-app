# Hearth worksession — PGlite Development canary

- **Status:** RELEASE REVIEW PASS — local candidate; not pushed, merged, or deployed
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/pglite-dev-canary`
- **Baseline SHA:** `b03a050f954730a7054da6ae5a3ca4aa0095c397`
- **Candidate implementation SHA:** `9e6da11c1d8dfb97f35593e149d9a1ce0a9cebaf`
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** the shared client bundle carries the flag, but only Development ledgers can activate it; Production remains on the full rebuild path

## Household outcome

Eligible Development Confirms use D-177's verified incremental PGlite projection so the kitchen returns sooner, while every Production ingest continues through the full transactional rebuild.

## Budget delta (5)

`+1` — activates the already-verified faster Development acceptance path without changing double-entry, canonical hash, rollback, durable snapshot, outbox, or Confirm authority.

## Engagement delta (3)

`+1` — ordinary Development posting should feel more immediate. Hercules and the visual grammar are unchanged.

## Verified baseline

- `origin/main@b03a050` contains D-177/D-178 and the current Development sync pilot.
- `src/ledger/engine.ts` requires both `environment === "development"` and `VITE_PGLITE_INCREMENTAL_DEV=1`; Production remains full even when an internal caller explicitly requests incremental ingest.
- The Cloudflare workflow did not pass `VITE_PGLITE_INCREMENTAL_DEV` into the Vite build, so changing a repository variable alone would not activate the canary.
- Hearth deploys one shared web client from `main`; “Development only” is therefore a ledger-runtime boundary, not a separate hosting target. The flag is present in the shared bundle, while two runtime guards keep Production writes full-rebuild.
- Jonathan explicitly directed the Development activation on 2026-08-31 and directed the earlier manual reconciliation to treat human phone/browser tests as complete.

## Scope

### In scope

- Bake `VITE_PGLITE_INCREMENTAL_DEV=1` into the shared kitchen build for Development-ledger use.
- Keep `VITE_PRODUCTION_CONTINUITY=0` and the code-level Production full-path guard.
- Fail the build if either workflow boundary drifts.
- Re-run current-main accounting, rollback, environment, build, and release checks.

### Out of scope

- Production incremental activation, Production continuity, schema, hosted rows, household data, secrets, provider settings, or financial meaning.
- Changing D-177 eligibility limits, projection SQL, compaction cadence, or fallback policy.

## Acceptance evidence

- [x] Focused workflow, books boundary, equivalence, rollback, fault, and performance tests pass (25 focused tests plus the benchmark).
- [x] Full product suite reached 1,298 passed and 3 skipped; its sole failure is the pre-existing Windows host constraint `spawnSync bash ENOENT` in `test/api.test.ts`.
- [x] AI surface verification, TypeScript, Vite production build, Hercules Pro UI build, redirect check, and `git diff --check` pass on the exact working candidate.
- [x] A production-mode build contains the Development flag while the Production runtime guard remains false.
- [x] Independent books audit and verifier return PASS; trust review returns conditional PASS only to document the shared-client hosting topology, now recorded above.
- [x] No secrets, exports, private artifacts, Production setting, schema, or hosted data enter the diff.

## Release evidence

- Focused: `test/pglite-development-canary.test.ts`, `test/books.test.ts`, and `test/performance-metrics.test.ts` — 25/25 passed.
- Performance fixture: incremental p50 `248.35 ms`, p95 `365.02 ms`; full p50 `466.69 ms`, p95 `816.26 ms`.
- Full suite: 197 files passed, 2 skipped; 1,298 tests passed, 3 skipped; only `test/api.test.ts` failed because Unix `bash` is unavailable on this Windows host.
- Independent review: books PASS; release verifier PASS; trust conditional PASS with no code blocker and the shared-client topology caveat documented.
- Human phone/browser checks: treated as complete under Jonathan's explicit instruction.

## Rollback

Set `VITE_PGLITE_INCREMENTAL_DEV` back to `"0"` (or remove it) in `.github/workflows/pages.yml` and redeploy. Existing v4 receipts remain valid; the next write returns to the full transactional rebuild. Kill immediately on projection/hash mismatch, rollback failure, invalid books, unbounded relation growth, or any Production incremental observation.

## Handoff

Candidate release review: **PASS** for Development-ledger canary activation. The release-review role does not push, merge, or deploy; Jonathan remains the action owner. After a later authorized release, observe Development `writeMode: incremental` and confirm any Production ingest remains `writeMode: full`; kill the canary immediately if Production reports incremental.
