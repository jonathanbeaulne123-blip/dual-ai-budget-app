# Hearth worksession — Fund Level

- **Status:** OPEN
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/fund-level`
- **Baseline SHA:** `44e5625fd91bfbe0516fd62bf50d366985c90203`
- **Head SHA:** `351cedecdb6d8c7b5929d48936f256a5d13bd148` (reviewed implementation head)
- **PR or issue:** pending
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

The configured Shared Household Fund opens on the Level: one accessible month-scale drawing that distinguishes posted facts from projections and explains the highest-priority Fund condition without adding a second balance.

## Budget delta (5)

`+3` — the existing authoritative Fund walk gains a legible full-stage view of balance, buffer, dry date, and projections.

## Engagement delta (3)

`+2` — the Fund's resting stage becomes a focused visual instrument while retaining the existing Ask beside it.

## Verified baseline

- `origin/main` is `44e5625fd91bfbe0516fd62bf50d366985c90203`, the merge of Fund next-out and consequence PR #314.
- The supplied patch was authored on the next-out slice. Its four new files apply directly; `OfficeWide.tsx` and `src/core/index.ts` require narrow reconciliation with the consequence-stage code now on `main`.
- The supplied apply note is context, not authority. Current code and tests decide integration.
- The source checkout has unrelated branch work; this dedicated worktree is the only writer.

## Scope

### In scope

- Apply the supplied Level patch and preserve its authored behavior.
- Render Level only for the resolved `level` rail stage, without displacing Next Out, Spoken For, Waiting, or the drawer.
- Verify FundWalk-only money derivation, Personal-data boundaries, keyboard/accessibility behavior, and responsive rendering.

### Out of scope

- New money commands, schema, dependencies, secrets, hosted data, Production, or deployment.
- Changes to Fund arithmetic, contribution authority, or household data.

## Acceptance evidence

- [x] Focused Level/Fund tests, TypeScript, AI verification, build, and repository quick gate pass.
- [x] Independent review returns PASS with no open privacy, accounting, or accessibility blocker.
- [x] Browser evidence covers representative narrow and wide layouts without household-data mutation.
- [x] No secret, export, workbook, chat, credential, or `.env` artifact is tracked.
- [ ] PR checks pass and the exact reviewed head is merged into `main`.

## Plan

- [x] Verify current `main`, isolate the worktree, and reconcile the patch seams.
- [x] Inspect and test the full diff.
- [x] Complete independent and browser review.
- [ ] Push, open the PR, wait for checks, and merge.

## Evidence log

- Ordinary `git apply --check` identified only the expected current-main overlaps in `OfficeWide.tsx` and `src/core/index.ts`.
- `pnpm install --frozen-lockfile` — passed from the existing lockfile and local content-addressed store.
- `pnpm exec tsc --noEmit` — passed.
- Fund/Level-adjacent Vitest — 12 files, 164 tests passed.
- `pnpm ai:verify` — passed; 48 required files and two Clerk fences.
- `pnpm build` — passed in 20.23 seconds; existing PGlite/Vite warnings only.
- Medium quick gate — `quick-gate-passed` in 46.3 seconds with no time-budget breach; 61 focused tests and 7 serial proof-matrix tests passed.
- Independent review first returned `FAIL`: estimate-dependent coverage could say `September is covered.` while the confirmed-money register remained $50 short. The Level now uses the compact Level's observed-plus-shortfall rule; a real command-built FundWalk regression test passes. Final independent verdict: `PASS`.
- Isolated browser fixture at 320, 390, 720, and 1100 px — document width always equalled viewport width; Level/SVG fit their container with no page overflow. Computed style kept actual stroke undashed and projected stroke `5px, 4px`. The accessible label named the $240 balance, September dry date, $1,500 buffer, and timing-only payday dates.
- Browser proof used only an in-memory demo fixture at isolated origin `127.0.0.1:5175`; no household snapshot, hosted row, or Production data was read or changed. Temporary preview files were removed before commit.
- Branch filename and credential-pattern scans are required immediately before push.

## Decisions

- Preserve the current resolved-stage model: Level renders only when `activeFundWidget === "level"`.
- Reuse `fundWalkToday`, `spokenFor`, `paydayTicks`, and the existing Ask; add no parallel balance or write path.
- Never call an estimate-dependent month covered: when observed inflow prevents a dry date but confirmed money is still short, state the exact register shortfall and that the dashed contribution is not confirmed.

## Remaining uncertainty

- PR checks and merge SHA are pending.

## Handoff

Open. Codex owns integration; Jonathan explicitly authorized push and merge. No deployment was requested.
