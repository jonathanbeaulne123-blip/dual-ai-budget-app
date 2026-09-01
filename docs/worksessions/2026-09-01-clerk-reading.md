# Hearth worksession — Clerk Slice 1 cited reading

- **Status:** CLOSED — MERGED TO LOCAL `main`; RELEASE AUTHORIZED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `clerk/1-reading`
- **Baseline SHA:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
- **Head SHA:** `6f1cb43f793312953fb733d795a0d0439d539f35`
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Hercules can later present a short local reading of recent household rows, where each sentence names its exact transaction or Fund-event sources and never becomes advice.

## Budget delta (5)

`+1` — citations and the existing conservation guard keep the reading attached to accepted ledger facts without creating a money writer or a new calculation.

## Engagement delta (3)

`+1` — a compact, source-visible reading can make the weekly record easier to enter without pressuring either member.

## Verified baseline

Facts:

- `origin/main@ff9d8d8` contains the accepted D-193 Held-motion core and `sharedMonthCourse(...).tiesToProjection` guard.
- The current workspace is dirty and on an unrelated branch, so this slice uses its own clean worktree.
- The dated build manual assigns D-184, but current canon already uses D-184 for provider failover.

Inference to prove:

- A leaf reader can use the existing guard and citations without changing Fund arithmetic, commands, or model boundaries.

## Scope

### In scope

- `src/core/clerkReading.ts` and focused command-driven/source-fence tests.
- A reconciled decision record for the cited-reader contract.

### Out of scope

- UI, model calls, commands, Fund arithmetic, Auth/RLS, hosted data/schema, secrets, Production, push, merge, and deploy.

## Acceptance evidence

- [x] Every returned sentence names at least one transaction or Fund event.
- [x] The reader has no advisory amount or work instruction language.
- [x] An untied conservation guard withholds sentences.
- [x] Focused tests, full suite, type check, build, and diff hygiene pass.

## Plan

- [x] Establish a clean branch from current `origin/main`.
- [x] Implement the local cited reader and focused tests.
- [x] Run the complete local gate and record results.

## Evidence log

- 2026-09-01: Created clean worktree `C:\Users\jonat\AppData\Local\Temp\hearth-clerk-1-reading` at `origin/main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`.
- 2026-09-01: Focused `test/clerk-reading.test.ts` passed 3/3; `tsc --noEmit` and `git diff --check` passed.
- 2026-09-01: Full `pnpm test` passed: ordinary lane `214 passed / 1 skipped` test files and serial books lane `17 passed / 1 skipped` test files. The package's literal `pnpm build` command is Windows-shell-incompatible because its `rm -rf` runs through `cmd`; the equivalent `tsc --noEmit`, `vite build`, Hercules Pro bundle, and no-`dist/_redirects` checks passed. Existing PGlite browser-external/eval, large-chunk, and React `act(...)` warnings were non-failing.
- 2026-09-01: Independent focused verifier rerun passed `4/4`, including the conservation-withheld case; diff hygiene passed for all new files.
- 2026-09-01: Pre-merge rerun passed the focused Clerk suite `4/4` and AI-surface verification. The aggregate Windows gate reached `1,447 passed / 2 skipped` ordinary tests and `139 passed / 1 skipped` serial tests, but remained non-green because `test/api.test.ts` requires unavailable `bash` and the unrelated dated Demo Suite fixture no longer produced an `upcoming` shift envelope. The Demo assertion failed again alone; Clerk changes do not touch Demo generation, Shift envelopes, or the host test. The earlier exact-tree full run remains green apart from the known Windows build-shell incompatibility.

## Decisions

- D-194 records the cited-reader contract because D-184 is occupied in current canon.

## Remaining uncertainty

- The current reader contract exposes `tiesToProjection` for a later surface to render the required honest withheld state; Slice 2 owns that visible treatment.

## Handoff

Jonathan authorized commit and local merge on 2026-09-01, then explicitly authorized push and Development deployment. `clerk/1-reading` was fast-forwarded into local `main`. The release path may publish this read-only code and documentation through the existing GitHub/Cloudflare workflow; it does not authorize schema, hosted-row, secret, household-data, or Production-continuity changes. Clerk Slice 2 may consume the sealed `ClerkReading` contract. Its durable Cursor packet is `docs/briefs/CURSOR_CLERK_SLICE_2_CITATIONS_2026-09-01.md`.
