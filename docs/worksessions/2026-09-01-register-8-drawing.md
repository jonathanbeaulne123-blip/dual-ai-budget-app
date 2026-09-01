# Hearth worksession — Register slice 8 drawing

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/register-8-drawing-115c`
- **Baseline SHA:** `ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`
- **Head SHA:** pending implementation commit
- **PR or issue:** draft PR after push
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

- [ ] Shared scale, arrival order, conservation, fail-closed, and phone list tests
- [ ] Focused plus TypeScript/diff gates
- [ ] Component visual proof at 320/390/720/~1100, not kitchen proof

## Plan

- [x] Implement geometry and drawing
- [ ] Focused tests
- [ ] Independent reviews
- [ ] Close after proof

## Evidence log

Baseline `origin/main@ff9d8d8de70c80fd567ba9835b3cc2ffbcd45082`.

## Decisions

The host supplies member display names and hers/his tones. The component does not infer Bianca/Jonathan from member ids, signed-in viewer, contribution size, or array position.

## Remaining uncertainty

Forced-colors contrast of muted text on paper-2 needs measured visual proof. No approved kitchen placement.

## Handoff

Next owner: independent books and UX reviewers, then Jonathan's merge decision. This is a branch/PR, not shipped or live.
