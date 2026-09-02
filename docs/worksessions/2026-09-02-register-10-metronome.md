# Hearth worksession — Register slice 10 metronome

- **Status:** OPEN
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/register-10-metronome-115c`
- **Baseline SHA:** `7101dced3d592f9c70d445ec4b901cc3ff8946b3`
- **Head SHA:** _pending_
- **PR or issue:** _pending draft_
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

- [ ] Ticks land on projected cadence dates
- [ ] No tick carries an amount
- [ ] Existing month-spread conservation suite still passes
- [ ] `courseScale` / `courseTop` / `courseBottom` source unchanged
- [ ] Focused tests plus `tsc --noEmit` and a broader local gate
- [ ] Visual proof at 320 / 390 / 720 / ~1100

## Plan

- [x] Pin `origin/main` and inspect Course + payday helpers
- [x] Implement `paydayTicks` and axis ticks
- [x] Add focused tests
- [ ] Independent audits, visual proof, ChatGPT review/merge packet

## Evidence log

- Baseline: `git checkout -B cursor/register-10-metronome-115c origin/main` → `7101dced3d592f9c70d445ec4b901cc3ff8946b3`
- Focused `pnpm exec vitest run test/month-spread.test.ts`: **39 passed** (existing conservation cases untouched plus six metronome cases)

## Decisions

- Ticks use `nextWorkScheduleDate` on each active custodian `paySchedule`, unioned across jobs. Tip schedules are not paydays.
- `--ms-tick: var(--felt)` honors the manual's `--felt` and the UX packet's `--tick` without a new hex.
- Passing `booksHousehold` into `MonthSpread` is a justified host wire: the Course is already the Shared Home stage.

## Remaining uncertainty

Demo kitchen Bianca and Jonathan share the same biweekly demo job, so ticks and contribution marks can land on related days. Distinct-cadence proof is in the focused tests, not the demo seed.

## Handoff

Local + branch. Draft PR pending. Not merged, not kitchen-published, not live. Next owner: GPT-5 Pro independent review, then Jonathan's merge decision via the ChatGPT packet. Do not stack #285. Do not touch Production.
