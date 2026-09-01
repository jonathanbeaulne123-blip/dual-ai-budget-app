# Hearth worksession — Register slice 8 drawing

- **Status:** CLOSED ON BRANCH; DRAFT PR; NOT MERGED; NOT DEPLOYED; NOT LIVE
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/register-8-drawing-115c`
- **Baseline SHA:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
- **Head SHA:** `3053da379f6b7bbae969aa49b604768a8f465e69`
- **PR or issue:** draft [#285](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/285)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Jonathan and Bianca can read the month's obligations as one honest, true-width register. Every row uses the same dollar-to-pixel scale, confirmed Fund money appears in arrival order, and any unfunded tail stays visibly unfilled. If the register does not tie to the ledger, Hearth shows no financial drawing rather than a plausible-looking partial one.

## Budget delta (5)

`+3` — the existing FIFO register becomes visually comparable and traceable without changing a cent, source, obligation, or projection.

## Engagement delta (3)

`+2` — the month becomes readable as a calm paper instrument on desktop and as a drawing plus equivalent list on phone. No gamification, judgment, celebration, or work instruction is added.

## Verified baseline

Facts:

- `origin/main@ff9d8d8` contains Register slices 1–7, D-193 Charter Held core, and the current sign-out/offline integration.
- `contributionRegister` already supplies obligation-ordered rows, FIFO segments, source totals, and `tiesToProjection`.
- `src/Register.tsx` and `src/core/registerView.ts` were absent on the baseline.

Inference:

- A pure presentation component can draw the attached register without a second allocator.

## Scope

### In scope

- `src/core/registerView.ts` geometry API
- `src/Register.tsx` / `src/register.css`
- `test/register-view.test.ts`
- export through `src/core/index.ts`
- D-161/D-173 why-note and this worksession

### Out of scope

- Kitchen placement, Ask panel, App/Office/routes
- Allocation, Fund events, commands, continuity, schema, workers, secrets, Production
- Test-lane configuration

## Acceptance evidence

- [x] Shared scale, arrival order, conservation, fail-closed, and phone list tests (`test/register-view.test.ts` plus neighbor `contribution-register`: **20 passed**)
- [x] TypeScript (`pnpm exec tsc --noEmit`)
- [x] Component visual proof at 320/390/720/~1100 (not kitchen)
- [x] Horizontal scroll restored on `.register-scroll`; SVG is decorative (`aria-hidden`); phone list is the accessible fact sheet
- [ ] Full `pnpm check`: serial `demo-suite` failed on an unrelated Shared-envelope assertion (not this slice)

## Plan

- [x] Implement geometry and drawing
- [x] Focused tests
- [x] Independent reviews (books PASS WITH NOTES; UX P0 overflow restored after the a11y follow-up)
- [x] Draft PR #285

## Evidence log

Baseline `origin/main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`.
- `7d66bc8` drawing; `452652a` fail-closed + keyboard; this closeout restores `overflow-x: auto` and keeps one AT path.
- Focused `pnpm exec vitest run test/register-view.test.ts test/contribution-register.test.ts`: **2 files / 20 tests passed**.

## Decisions

The host supplies member display names and hers/his tones. The component does not infer Bianca/Jonathan from member ids, signed-in viewer, contribution size, or array position. The 900px staff is visual; the semantic list is the accessible fact sheet at every width.

## Remaining uncertainty

Forced-colors distinct hers/his/carried fills still need measured proof. Empty tied months still show `Nothing owed this month yet.` rather than source totals (packet line). No approved kitchen placement. Serial `demo-suite` failure is outside this slice.

## Handoff

Next owner: Jonathan's merge decision on draft [#285](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/285). Not shipped. Not live. Do not stack Slice 9 on this PR.
