# Hearth worksession — FAB add speed dial

- **Status:** OPEN
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/shared-ledger-story-aef7`
- **Baseline SHA:** `e6851ba`
- **Head SHA:** `ba752c2`
- **PR or issue:** draft [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244)
- **Risk:** Low–Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Nav `+` fans out Shift, Income, Expense, and Transfer into the existing Add sheet. Nothing posts until Confirm.

## Budget delta (5)

`+2`

## Engagement delta (3)

`+2`

## Scope

### In scope

- Vertical linear paper speed dial on the existing FAB.
- Route each action through `openAddFor(null, mode)`.

### Out of scope

- New money commands, month-instrument redesign, merge, deploy.
- Redesigning Add tabs or OfficePhone mosaic.

## Acceptance evidence

- [x] Focused DOM tests: open, pick expense, Escape, closed-when-adding, no postEntry in the dial.
- [x] `pnpm check` (FAB tests green; unrelated hercules-pro this_week empty on 2026-08-31)
- [x] Visual: Shared Home `+` → four actions → Add expense/shift/transfer/income; Escape closes. 1100 + 390.

## Plan

- [x] Implement `FabSpeedDial` and wire nav.
- [ ] Prove with check + browser.
- [ ] Handoff.

## Remaining uncertainty

320px label width. Hercules overlap when the dial is open is mitigated by raising nav z-index.

## Handoff

Not merged, not deployed, not live.
