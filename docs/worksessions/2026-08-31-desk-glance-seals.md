# Hearth worksession — Glance plates, seal lists, scrolling month sheet

- **Status:** OPEN; IMPLEMENTING
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/desk-glance-seals-021f`
- **Baseline SHA:** `2690c57` (`origin/main`)
- **Head SHA:** (in progress)
- **PR or issue:** draft against `main`
- **Risk:** High (presentation)
- **Decision owner:** Jonathan
- **Environment impact:** none — fictional Development demo for proof; no Production, hosted mutation, schema, or secrets

## Household outcome

The six left stories sit short at a glance and grow down for the drawing and extra line. Money in opens this month’s posted income list. Money out opens this month’s posted expense list. The middle month sheet is a fixed height that scrolls inside, even with the bottom of six open left cards. Leftover spend still goes to Plan. Phone Home is unchanged.

## Budget delta (5)

`+3` — glance lines and the two seal lists are the posted month, not a second Fund story.

## Engagement delta (3)

`+3` — less wall of text; one tap to the matching list; the month sheet no longer eats the whole desk.

## If they conflicted

Books win. Lists are display only. Refunds stay out of the expense list (they are not ordinary spend). Shared lists use the floor’s visible books, not a partner’s private rooms. No `goal.savedCents` writes.

## Verified baseline

Facts:

- Desk plates already ship on `main@2690c57`. Click currently puts the plate on the stage.
- Money in and Money out both open the Month net blotter.
- Shared Home stage uses `overflow: visible`, so the Month Spread grows to full height.
- Jonathan confirmed four notes on 2026-08-31.

Inferences:

- Centre height matches six *open* cards, even when the left cards are closed.
- Opening a left card grows in the column; it does not replace the month sheet.
- Phone seals stay on the blotter until Jonathan says otherwise.

## Scope

### In scope

- Glance vs open plates in the left column (Shared and Personal wide Home).
- Money in → this month’s income rows; Money out → this month’s expense rows.
- Month sheet (and the personal desk notebook) fixed height with inner vertical scroll.
- Focused tests.

### Out of scope

- Leftover spend seal (stays Plan).
- iPhone `OfficePhone`.
- Fund math, Kitty restyle, schema, Production, merge, deploy.

## Acceptance evidence

- [ ] Glance copy; open shows figure, footing, Cabinet
- [ ] Click no longer replaces the month sheet
- [ ] Money in / out lists this month; display only
- [ ] Stage height token matches three open plate rows
- [ ] Focused tests and `pnpm check`
- [ ] Draft PR; not merged, not deployed, not live

## Plan

- [ ] Glance field + expand state
- [ ] Seal month lists
- [ ] Stage scroll height
- [ ] Tests, check, draft PR, browser proof

## Evidence log

- 2026-08-31: Jonathan confirmed the four-note packet. Branched from `origin/main@2690c57`.

## Decisions

- Multi-open left cards. Height ruler is six open, not the current collapsed stack.
- Expense list follows `partitionLedger`: refunds are not expenses.

## Remaining uncertainty

- Live forced-colors / reduced-motion DevTools.
- At stacked widths the stage sits under the mosaic; the same height cap still applies.

## Handoff

In progress. Local branch until the first commit is pushed.
