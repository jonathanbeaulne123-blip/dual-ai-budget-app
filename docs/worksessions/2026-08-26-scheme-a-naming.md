# Hearth worksession — Scheme A naming clarity

- **Status:** OPEN
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/scheme-a-naming-clarity-0893`
- **Baseline SHA:** `0029ee0`
- **Head SHA:** (in progress)
- **PR or issue:** pending
- **Risk:** Medium
- **Decision owner:** Jonathan (D-144)
- **Environment impact:** none (copy/labels only; no money math, schema, secrets, Production)

## Household outcome

Every chrome control Bianca and Jonathan see uses plain Scheme A human names (Goals, Groceries, Health, Sit-down, Shifts). Only in-app Hercules AI talk and Hercules Pro may use cat/kitchen metaphors, and those lines always gloss the human money meaning in the same breath.

## Budget delta (5)

`+2` — money actions, Confirm, and books surfaces stop sharing metaphors that collide (Close seal vs Close month; Milk grocery vs tax milk; Jars/Pigs/Vault).

## Engagement delta (3)

`+1` — Hercules keeps personality in AI/Pro talk; chrome stops sounding like a second dialect. Kill criterion: any money button that only says a cat word with no human meaning.

## Verified baseline

- `main@0029ee0` after fast-forward from `f2b90d3`.
- Inventory from UI audit: Goals/Jars/Pigs/Vault, Close seal→Health, Milk vs tax milk, Timesheet vs Shifts, Postcard vs Sit-down.

## Scope

### In scope

- User-visible labels, buttons, chips, dialogs, instrument titles, seals, empty states.
- Hercules AI/Pro spoken copy clarified with human glosses.
- Decision D-144, worksession, focused tests, handoff.

### Out of scope

- Money math, Commands, Auth/RLS, migrations, deploy, Production.
- Renaming internal instrument ids (`jars`, `postcard`, etc.) unless a test requires display-string updates.
- Full theme redesign.

## Acceptance evidence

- [ ] No money chrome button uses an ungossed cat-only label.
- [ ] Seals: Post / Due / Health (not Close).
- [ ] Goals instrument titled Goals; Start this goal; Mark purchased; Completed goals; Goals savings.
- [ ] Groceries chip and Post groceries (not Milk) on Pad/Add.
- [ ] Hercules talk that still says milk/pigs/etc. includes the human meaning.
- [ ] Focused + `pnpm check` green.

## Plan

- [x] Lock Scheme A map in `src/core/naming.ts` + D-144
- [ ] Apply chrome renames
- [ ] Clarify Hercules AI/Pro talk
- [ ] Tests + handoff + PR

## Evidence log

## Decisions

- D-144 Scheme A chrome; Hercules talk only in AI/Pro with mandatory gloss.

## Remaining uncertainty

- Some historical activity strings ("Chalkboard", "Monthly Sit-Down") may remain in audit history rows.

## Handoff

Next owner: Jonathan review of PR naming samples on phone + desktop Home.
