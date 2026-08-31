# Hearth worksession — The Month Spread

- **Status:** OPEN; draft PR in progress
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (landing Claude's local packet onto current `main`)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/month-spread-shared-home-04e5`
- **Baseline SHA:** `2a984fd3346dc0b57d0e7b6a17702c18b82596d3` (`origin/main`)
- **Head SHA:** pending docs + proof
- **PR or issue:** pending
- **Risk:** High (presentation of Shared Home plus two `projectHouseholdFund` figure corrections)
- **Decision owner:** Jonathan for merge/deploy; independent books review required for F-2/F-3 before merge
- **Environment impact:** Development demo seed only; no Production, hosted schema, secrets, or household data

## Household outcome

Shared Home's centre stops being a placeholder sentence ("Touch a tile. Kitty Banks stay on the right.") and becomes the month drawn as one instrument — where the two of you stand, how the month got there, and who has to do something next. The seals, mosaic, and Kitty Banks shelf keep their words, arithmetic, and styling.

## Budget delta (5)

`+3` — the Fund's month is legible at a glance, and Fund free-to-spend is named as distinct from the seals' leftover spend. F-2/F-3 make the reconciliation stamp and monthly-target assay mean what their labels say.

## Engagement delta (3)

`+3` — this is the laptop open-to frame.

## If they conflicted

Books won. Three places the prettier answer lost:

- The Kitty is drawn at the **same scale** as the operating pool (a thin ribbon, not a bold second band).
- The Course renders an **empty staff** rather than a picture when the drawing does not tie to `projectHouseholdFund`.
- The shelf says surplus rolled into the shared banks as a **claim**, not that the banks hold the same figure as the Kitty.

## Verified baseline

Facts:

- Kitchen desk (D-164/D-173) is already on `origin/main` via #252. `OfficeWide.tsx`, `sharedLedgerStory.ts`, `householdFund.ts`, and `KittyBanks.tsx` match `cursor/shared-ledger-story-aef7` at the packet cut.
- Claude built the instrument on `cursor/shared-ledger-story-aef7` @ `ba752c2`. That branch has since moved (FAB / Add slideshow) and cannot push; the work arrived as a two-commit `git am` patch.
- Current `main` has D-172 Shift Bible seeding and `KitchenErrorBoundary` that the patch's base lacked.

Inferences:

- Applying onto current `main` is the shippable Shared Home. Stacking on draft PR #244 would hold the Spread behind unmerged FAB/slideshow work and miss every `main` commit after kitchen-desk integration.

## Scope

### In scope

- `sharedMonthCourse` selector that re-folds existing `projectHouseholdFund` arithmetic with a tie guardrail.
- Course geometry (`monthSpread.ts`) with one shared scale.
- `MonthSpread` as the Shared Home stage when no instrument or story panel is open.
- Development demo seed of a Fund month through real commands; two extra shared banks.
- F-1: `fundRolloverByGoal` so the shelf can say what the Fund rolled without moving `savedCents`.
- F-4: shelf drops under the stage below 1200px so 1100px has no inner Course scroll.
- F-5: guard that the seeded Fund-backed bill sits on a category with no posted history.
- F-2/F-3: isolated commit changing `lastReconciledAt` to event `date` and `targetProgressCents` to this month's confirmed contributions.

### Out of scope

- New Fund event kinds, envelopes, schema, or moving `goal.savedCents` on rollover.
- Merge, deploy, Production, hosted mutation, secrets.
- Replacing Attention/Change mosaic tiles (they still open their panels).
- iPhone `OfficePhone` redesign.

## Acceptance evidence

- [ ] Focused `test/month-spread.test.ts` plus related Fund/seed/rhythm tests
- [ ] `pnpm check` (or documented pre-existing failures only)
- [ ] Visual proof at 320 / 390 / 720 / 1100 / ~1440, configured and unopened
- [ ] Independent books review of F-2/F-3 before merge
- [ ] Independent UX review of the instrument
- [ ] Docket does not post; Confirm remains the writer

## Plan

- [x] Inspect current `main` vs packet base; apply onto `main` with D-172 Bible seed preserved.
- [x] Split F-2/F-3 into their own commit.
- [ ] Focused tests, then full `pnpm check`.
- [ ] Independent auditors (books, UX, trust).
- [ ] Browser proof and walkthrough artifacts.
- [ ] Draft PR targeting `main`. Do not merge unless Jonathan asks.

## Evidence log

- 2026-08-31: branched `cursor/month-spread-shared-home-04e5` from `origin/main@2a984fd`.
- 2026-08-31: `git am --3way` of the two-commit patch. Only conflict: `src/core/seed.ts` — kept D-172 Shift Bible mapping and inserted `seedHouseholdFund`.
- 2026-08-31: split original findings commit into presentation (`7366907`, F-1/F-4/F-5) and money (`d737dd6`, F-2/F-3).
- Packet origin: Claude local `claude/month-spread-shared-home` @ `0255566` + `364569a`, undeliverable upstream (git proxy 403).

## Decisions

- Apply onto current `main`, not `cursor/shared-ledger-story-aef7`. Kitchen desk already shipped via #252; Shared Home files are identical; `main` has later trust/performance/auth work the packet must not drop.
- Do not move `savedCents` on rollover (D-161). The shelf reports the claim.
- Do not merge F-2/F-3 without an independent books review.

## Remaining uncertainty

- Live hover/focus readout, draw-on animation, `prefers-reduced-motion`, and forced-colors are asserted in source/CSS; browser proof is still open.
- Attention and Change mosaic tiles still open panels whose content the Spread absorbs — catalog question for Jonathan.
- Hero framing leads on Fund free-to-spend, not operating balance.

## Handoff

Next owner: Jonathan after the draft PR exists. Local / branch / PR / not merged / not deployed / not live. F-2/F-3 wait on books review. Do not merge unless Jonathan asks.
