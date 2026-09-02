# Hearth worksession — Register slice 10 metronome

- **Status:** OPEN
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/register-10-metronome-115c`
- **Baseline SHA:** `7101dced3d592f9c70d445ec4b901cc3ff8946b3`
- **Head SHA:** fetch `origin/cursor/register-10-metronome-115c`. Exact-head CI: `843a21eff4b25d295d96a5305aafd64d2247760c`. Product Chip-above-axis: `b1f66f0cac67172d45f11bda3c4cd2fd9e25b0a0`. Verify `git rev-parse HEAD` after fetch.
- **PR or issue:** draft [#294](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/294)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

On the Month Spread Course, Bianca's projected paydays appear as regular felt ticks below the axis (timing only, no amount). Jonathan's confirmed contributions keep their existing irregular marks. The contrast is the information.

## Budget delta (5)

`+3` — the month's economics become legible without a second allocator, assumed paycheck CAD, or a change to Course scale.

## Engagement delta (3)

`+2` — one new mark type on the already-shipped Course. No streak, score, or work instruction.

## Verified baseline

Facts:

- `origin/main@7101dce` (Merge #292 Ask confirm) already contains `nextPaydayDate` / `nextWorkScheduleDate` and the live Month Spread.
- Register slice 8 drawing remains a separate draft (#285) and is not stacked.
- `courseScale`, `courseTop`, and `courseBottom` are conservation law; this slice must not edit them.

Inference:

- Union of the custodian's active `paySchedule` dates in the month, using the same timing primitive as `nextPaydayDate`, is enough to draw ticks without inventing CAD.

## Scope

### In scope

- `paydayTicks(household, monthKey)` and `PaydayTick` (date only).
- `tick` drawing on the Course axis: 3px `--felt` / `--ms-tick` rule below the axis; first labelled `payday`.
- Focused tests in `test/month-spread.test.ts` without changing existing conservation assertions.
- D-161/D-173 why-note. OfficeWide `household={booksHousehold}` so the live Course can draw.

### Out of scope

- Changing `courseScale` / `courseTop` / `courseBottom`.
- Register drawing (#285), Ask panel stacking, Till, OfficePhone, commands, posting, schema, hosted rows, secrets, Production, deploy.

## Acceptance evidence

- [x] Ticks land on projected cadence dates
- [x] No tick carries an amount
- [x] Existing month-spread conservation suite still passes
- [x] `courseScale` / `courseTop` / `courseBottom` source unchanged
- [x] Focused tests plus `tsc --noEmit` and `pnpm test:fast`
- [x] Visual proof at 320 / 390 / 720 / ~1100

## Plan

- [x] Pin `origin/main` and inspect Course + payday helpers
- [x] Implement `paydayTicks` and axis ticks
- [x] Add focused tests
- [x] Independent audits, visual proof, ChatGPT review/merge packet

## Evidence log

- Baseline: `git checkout -B cursor/register-10-metronome-115c origin/main` → `7101dced3d592f9c70d445ec4b901cc3ff8946b3`
- Focused `pnpm exec vitest run test/month-spread.test.ts`: **40 passed** (existing conservation cases untouched plus metronome cases, including divergent `tipSchedule`)
- Bianca Month: **10 passed**. Local `pnpm check` on `843a21e` exit 0 (fast 1,511/2 skipped; books 146/1 skipped; Vite 404 modules).
- GitHub `test` exact-head `843a21e`: push `33597093965` success; PR `33597098018` success.
- Independent books PASS WITH NOTES. Privacy PASS WITH NOTES. UX PASS WITH NOTES (label collision/clip) then Chip above the axis. Verifier PASS WITH NOTES.
- Component harness screenshots at 320 / 390 / 720 / 1100 plus empty, night, reduced-motion. Fictional Development copy. Not kitchen.
- Draft PR #294. Not merged, not deployed, not live.

## Decisions

- Ticks use `nextWorkScheduleDate` on each active custodian `paySchedule`, unioned across jobs. Tip schedules are not paydays.
- `--ms-tick: var(--felt)` honors the manual's `--felt` and the UX packet's `--tick` without a new hex.
- Passing `booksHousehold` into `MonthSpread` is a justified host wire: the Course is already the Shared Home stage.
- The `payday` word sits in an existing Chip **above** the axis. Ticks remain below the axis. Near the right edge the Chip uses `anchorEnd`.

## Remaining uncertainty

Demo kitchen Bianca and Jonathan share the same biweekly demo job, so ticks and contribution marks can land on related days. Distinct-cadence proof is in the focused tests, not the demo seed.

## GPT release integration repair — 2026-09-02

- Integrated the slice with current `origin/main@1c03cbedc10ca5f14ca51bf4067db5ba142a91c5` while preserving the merged Clerk weekly document and both living-doc histories.
- Normalized CRLF to LF inside the exact-source conservation fence so the focused suite is cross-platform; Course geometry is unchanged.
- Prevented the existing Ask flex host from shrinking and clipping Month Spread. The existing wide stage scroll now exposes the complete Course and Docket at 720px and 1100px.
- Focused integration: `test/month-spread.test.ts`, `test/ask-panel.test.ts`, `test/weekly-document.test.ts`, and `test/weekly-document-ui.test.ts` — **63 passed**.
- Final local `pnpm check:windows`: AI surface green; fast lane **1,526 passed / 2 skipped**; serial books lane **146 passed / 1 skipped**; TypeScript and both production builds green.
- Rendered fictional Development verification: 320px and 390px keep `OfficePhone` with no Month Spread or horizontal overflow; 720px and 1100px show three 3px × 8px felt ticks, one `payday` label, timing-only aria copy, and a scroll-reachable complete Course.
- No hosted row, schema, secret, provider, household-data, or Production mutation.

## Handoff

Local + branch + draft PR #294. Not merged, not kitchen-published, not live. ChatGPT independent review-and-merge packet: `docs/briefs/CHATGPT_REGISTER_SLICE_10_METRONOME_REVIEW_MERGE_2026-09-02.md`. Next owner: GPT-5 Pro, then merge only if named gates pass. Do not stack #285. Do not touch Production.

## Current-main release reconciliation — 2026-09-02

- `origin/main` advanced to `9c49e6fd1998e9687820c8eedea4f6a7b062805a` through Till Slice 1 while the first exact-head checks ran.
- Integrated that main tip with a merge commit. The only conflict was the first release-summary position in `docs/AI_HANDOFF.md`; both Register and Till summaries were preserved. Source and tests merged automatically.
- Cross-slice focused proof covering Month Spread, Ask layout, custody, month obligations, and the weekly document: **6 files / 75 tests passed**.
- Official `pnpm check:windows` rerun on the integrated code: **exit 0**; AI surface, **1,532 fast tests / 2 skipped**, **146 serial books tests / 1 skipped**, TypeScript, production build, Hercules Pro UI, and redirect guard passed.
- The integrated PR head must receive fresh exact-head GitHub checks before merge. Still no hosted row, schema, secret, provider, household-data, or Production mutation.
- After those checks passed, `origin/main` advanced again to `5828d9f156ef3cefe9a9a46a9341e0627651c22a` through the docs-only Till release record. Integrated it without source/test changes, kept the newer Till ownership wording, and required fresh exact-head CI on the resulting PR head.
