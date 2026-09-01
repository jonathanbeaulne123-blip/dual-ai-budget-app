# Hearth worksession — Register slice 9 Ask panel

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/register-9-ask-panel-115c`
- **Baseline SHA:** `09be0dcde24356ede228d136fb8cc26498042697`
- **Head SHA:** `be3d7a8` plus watching-caveat follow-up on this branch
- **PR or issue:** draft [#288](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/288)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Jonathan can read this month's Fund Ask on his wide desk: the exact unfunded number, optional conservative work routes drawn at one scale, and the other door in the open. Bianca's default surface never receives this panel. Nothing here posts, defers a goal, or invents a second allocator.

## Budget delta (5)

`+3` — the existing Ask, alternatives, and routes become a readable desk instrument without changing a cent, route, or command.

## Engagement delta (3)

`+2` — the number, routes, and other door sit together on Jonathan's desk. No streak, ring, score, celebration, or work instruction.

## Verified baseline

Facts:

- `origin/main@09be0dc` already contains Register slices 5–7: `householdAsk`, `askAlternatives`, `askRoutes`.
- Register slice 8 (the register drawing) is **not** on this baseline and is not stacked.
- Till slice 4 (`landingSurface`) is not implemented. Placement uses the existing custodian id: Ask mounts only on `OfficeWide` Shared Home when the viewer is not the Fund custodian.
- There is no defer-goal command. `Raise it` must not post or mutate the household.

Inference:

- A pure presentation fold can compose the three existing projectors without a second money writer.

## Scope

### In scope

- `src/core/askView.ts` geometry and panel fold
- `src/Ask.tsx` + `src/ask.css`
- `OfficeWide` placement on Jonathan's desk
- `test/ask-panel.test.ts`
- D-161/D-173 why-note (no new D-number)

### Out of scope

- Register drawing / kitchen wiring of Slice 8
- Metronome (slice 10)
- Till, OfficePhone, landing-surface preference
- A new goal-deferral command or Fund writer
- Hosted schema, secrets, Production, deploy, merge

## Acceptance evidence

- [x] Figure, sentence, payday line, routes, other door, watching caveat in that order
- [x] Covered `$0.00` pine; routes and door hidden
- [x] `not-enough-data` still shows the amount; panel stays
- [x] Other door visible whenever alternatives exist; never behind a toggle
- [x] Custodian `OfficeWide` does not mount Ask; `OfficePhone` does not import it
- [x] Fence: no `you should` / `you need to` / `pick up a shift`; no `%` score; no `postEntry`
- [x] `Raise it` does not change the household
- [x] Focused tests plus `pnpm exec tsc --noEmit` and `pnpm test:fast`
- [x] Visual proof at 320 / 390 / 720 / ~1100

## Plan

- [x] Implement `askView` scale and drawing model
- [x] Implement `Ask` + CSS
- [x] Gate `OfficeWide` to non-custodian Shared Home
- [x] Tests, why-note, handoff, draft PR

## Evidence log

- Baseline `origin/main@09be0dc`. Isolated from #285 and #286.
- Focused `pnpm exec vitest run test/ask-panel.test.ts`: **8 passed**. Neighbours ask/ask-alternatives/ask-routes: **22 passed**.
- `pnpm exec tsc --noEmit` passed.
- `pnpm test:fast`: **215 files passed / 1 skipped**, **1464 tests passed / 2 skipped**.
- Bianca Month: `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts`: **10 passed**.
- Independent books audit: PASS. UX: PASS WITH NOTES (routes scroller now `tabIndex={0}` + `role="img"`). Privacy: PASS WITH NOTES (no painted partner-personal leak).
- Visual harness screenshots at 320 / 390 / 720 / 1100, Raise-it focus, routes focus, night, reduced-motion. Fictional Development copy only.
- Draft PR #288. Not merged, not deployed, not live.

## Decisions

Placement uses `memberId !== householdFund.custodianMemberId` because Till slice 4 is absent. `Raise it` calls an optional host callback and does not invent a writer.

## Remaining uncertainty

Payday secondary copy only appears when `householdAsk(..., "payday")` actually takes the payday horizon. Provisional run-rate has no extra Ask caveat in core; the panel follows that and only surfaces the watching line.

## Handoff

Draft PR #288 on `cursor/register-9-ask-panel-115c`. Local + branch + draft PR. Not merged, not deployed, not live. Next owner: Jonathan after independent review. Do not stack metronome or Till.
