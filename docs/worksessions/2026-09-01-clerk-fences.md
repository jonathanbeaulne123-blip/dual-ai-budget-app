# Hearth worksession — Clerk Slice 3 enforceable fences

- **Status:** CLOSED — LOCAL IMPLEMENTATION VERIFIED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `clerk/3-fences`
- **Baseline SHA:** `origin/main@8fb0a5f11a11a4b251bef0eb031940d9c201997b` plus final observed draft Slice 2 head `0dd64ca46e3670389bc866ad8a9a97cf08f362a9`
- **Head SHA:** `2ed875de411f37e955d0d14edb724aad86d2e3bb` (this record follows as the next commit)
- **PR or issue:** depends on draft PR #287; no Slice 3 PR
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

The Clerk's promise to quote the record without proposing money or work becomes a failing build rule, not optional copy discipline.

## Budget delta (5)

`+1` — a future Clerk change cannot silently add advice, work instructions, or a money-writing dependency without breaking verification.

## Engagement delta (3)

`0` — this slice adds no visible interaction; it protects the trustworthiness of Slice 2's citation experience.

## Verified baseline

Facts:

- `origin/main@8fb0a5f` contains the released Slice 1 cited reader.
- Cursor's draft PR #287 was re-fetched at head `0dd64ca46e3670389bc866ad8a9a97cf08f362a9` immediately before close.
- The combined Slice 1 + Slice 2 + Slice 3 focused suite passes: 3 files / 17 tests.
- Slice 3 owns new `test/clerk-fences.test.ts` and a modification to `scripts/verify-ai-surface.mjs`; it does not share an implementation file with Cursor.

Inference to prove:

- A filename-scoped source scan plus command-driven output tests can enforce the Slice 3 boundary without changing Slice 1 or Slice 2 behavior.

## Scope

### In scope

- Build-level Clerk advice, work-instruction, and money-writer fences in `scripts/verify-ai-surface.mjs`.
- Command-driven readings across several synthetic household states.
- Static source proof over every `src/**/clerk*.ts(x)` file.

### Out of scope

- Any edit to Cursor's Slice 2 component, CSS, or tests.
- Clerk UI placement, weekly scheduling, model/provider work, new calculations, commands, persistence, network, schema, hosted data, secrets, Production, push, PR, merge, or deploy.
- Repairing the unrelated date-sensitive Demo Suite assertion currently red on `main` CI.

## Acceptance evidence

- [x] Every sentence across the synthetic spread remains cited.
- [x] No output sentence matches proposal/recommendation or work-instruction language.
- [x] Every Clerk-owned source file is scanned by `pnpm ai:verify`.
- [x] Clerk-owned sources import or invoke no money-writing path.
- [x] Slice 1, Slice 2, and Slice 3 focused tests pass together.
- [x] `pnpm ai:verify`, TypeScript, build, and working-tree diff hygiene pass.
- [x] Cursor PR #287 head was re-fetched before close; drift was reconciled and the combined proof rerun.

## Plan

- [x] Establish a separate stacked branch and exact two-slice baseline.
- [x] Implement the build and runtime-output fences.
- [x] Run focused and aggregate verification.
- [x] Re-fetch Cursor's dependency and close with exact evidence.

## Evidence log

- 2026-09-01: Created `clerk/3-fences` from `origin/main@8fb0a5f`, merged draft Slice 2 head `44426f6`, and committed the stack at `1116e5b`.
- 2026-09-01: Baseline `test/clerk-reading.test.ts test/clerk-citations.test.ts` passed 12/12.
- 2026-09-01: Implemented the source and output fences at `cfe5f69`, then reconciled Cursor's updated Slice 2 head `0dd64ca` in merge `b887d94` without conflict.
- 2026-09-01: Hardened the money-write fence to reject broad core re-exports and known post, transfer, shift, contribution-confirmation, reversal, command-runtime, storage, and hosted writer paths at `2ed875d`.
- 2026-09-01: Combined focused proof passed 3 files / 17 tests. `pnpm ai:verify` passed with 41 required files and 2 Clerk-owned source fences.
- 2026-09-01: `pnpm exec tsc --noEmit`, `pnpm exec vite build`, `pnpm build:hercules-pro-ui`, absence of `dist/_redirects`, and working-tree `git diff --check` passed. Existing Vite/PGlite and bundle-size warnings remain unchanged.
- 2026-09-01: Full `pnpm check` reached 215 passed / 1 skipped ordinary files (1,460 passed / 2 skipped tests) and 16 passed / 1 skipped serial files (139 passed / 1 skipped tests). It remains red only for the known Windows `spawnSync bash ENOENT` host constraint and the current-main date-sensitive Demo Suite `upcoming` assertion; both predate Slice 3.
- 2026-09-01: Re-fetched draft PR #287 at `0dd64ca`; no further dependency drift was present. Removed one trailing space from the dependency worksession on this integration branch so committed-range diff hygiene can pass.

## Decisions

No new product decision. This slice enforces D-194 and the accepted Slice 1 contract.

## Remaining uncertainty

Draft PR #287 may advance after this close. Before a Slice 3 PR or merge, refresh this stacked branch to Cursor's then-current Slice 2 head and rerun the combined focused proof. Repository-wide `pnpm check` cannot be green until the two documented baseline/host failures are repaired or expire.

## Handoff

Local stacked branch only, verified against draft Slice 2 head `0dd64ca`. No push, PR, merge, deploy, hosted action, schema, secret, Production action, or household-data mutation.
