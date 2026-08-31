# Hearth worksession — The Month Spread

- **Status:** CLOSED; MERGED #259; KITCHEN PUBLISHED
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (landing Claude's local packet onto current `main`)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `main` (from `cursor/month-spread-shared-home-04e5`)
- **Baseline SHA:** `2a984fd3346dc0b57d0e7b6a17702c18b82596d3` (cut); merged through `origin/main@d9529e5` (D-184 docs)
- **Head SHA:** `d648258e5c1d55a5af9c2c2e6962d46eb8bd09e7` (merge commit)
- **PR or issue:** merged [#259](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/259)
- **Risk:** High (presentation of Shared Home plus two `projectHouseholdFund` figure corrections)
- **Decision owner:** Jonathan ordered merge/push/deploy 2026-08-31
- **Environment impact:** Development demo seed for proof; kitchen SPA published via D-041; no Production household mutation, hosted schema, or secrets

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

- [x] Focused `test/month-spread.test.ts` plus related Fund/seed/rhythm tests — **74 passed / 0 failed** (8 files)
- [x] `pnpm check` — AI surface verified; **1311 passed / 3 skipped**; `tsc --noEmit` + Vite + Hercules Pro UI build green
- [x] Live Shared Home on the fictional Development demo kitchen: Month Spread is the centre; docket navigates; Development pill and custody disclosure present
- [x] Independent books review of F-2/F-3: **PASS WITH NOTES**; merge still gated on Jonathan
- [x] Trust P0/P1 (Course vs Standing household): repaired — Course reads `booksHousehold`
- [ ] Forced-colors and `prefers-reduced-motion` live DevTools emulation (CSS is in `src/month-spread.css`; automation could not set Chrome Rendering dropdowns)
- [x] Docket does not post; Confirm remains the writer
- [x] Viewport proof: wide Spread; ~1100 shelf under stage (F-4); 720 OfficeWide Spread after scroll; 390/320 OfficePhone, Add unobstructed

## Plan

- [x] Inspect current `main` vs packet base; apply onto `main` with D-172 Bible seed preserved.
- [x] Split F-2/F-3 into their own commit.
- [x] Focused tests, then full `pnpm check`.
- [x] Browser proof and walkthrough artifacts.
- [x] Draft PR targeting `main`. Do not merge unless Jonathan asks.
- [x] Independent auditors close (books PASS WITH NOTES; trust FAIL repaired; UX P1s repaired; privacy PASS WITH NOTES). Jonathan books-review of F-2/F-3; rebase onto current `main` before merge; merge/deploy only if Jonathan asks.

## Evidence log

- 2026-08-31: branched `cursor/month-spread-shared-home-04e5` from `origin/main@2a984fd`.
- 2026-08-31: `git am --3way` of the two-commit patch. Only conflict: `src/core/seed.ts` — kept D-172 Shift Bible mapping and inserted `seedHouseholdFund`.
- 2026-08-31: split original findings commit into presentation (`7366907`, F-1/F-4/F-5) and money (`d737dd6`, F-2/F-3).
- Packet origin: Claude local `claude/month-spread-shared-home` @ `0255566` + `364569a`, undeliverable upstream (git proxy 403).
- 2026-08-31: focused 8 files / 74 tests passed, including all 29 `month-spread` cases and F-2/F-3/F-5.
- 2026-08-31: `pnpm check` green — 194 files passed / 2 skipped; 1311 tests passed / 3 skipped; Vite 369 modules.
- 2026-08-31: live demo via `pnpm dev` + trycloudflare (not the kitchen URL, not a D-041 deploy). Open the demo kitchen table as Jonathan. Observed: Standing lede `$2,018.60` Fund free-to-spend vs seals leftover `$498.64`; monthly target `$3,260.00 of $3,400.00`; docket click opened Household Fund and did not post; colophon custody + `development`; no console errors.
- Today is 2026-08-31, so the seeded next-day Fund bill falls in September and reserved reads `$0.00` — that is the month boundary, not a regression.
- 2026-08-31 (same VM, finish pass): Shared Home re-opened at `http://127.0.0.1:5174/` as Jonathan. Standing `$2018.60`, leftover-spend `$498.64`, monthly target `$3260 of $3400`, TIED 27 August, Kitty conserved `$1285.00`, transfer due `$161.40`. Docket click still opens Household Fund and does not post. Artifacts: `month_spread_1440_shared_home.png`, `month_spread_1100_shelf_below.png`, `month_spread_720_spread_visible.png`, `month_spread_390_phone_home.png`, `month_spread_320_phone_home.png`, `month_spread_docket_navigates_to_fund.png`, `month_spread_shared_home_demo.mp4` (reviewed: login → Spread → docket → Fund, no post).
- 2026-08-31 (auditor fold): Independent books **PASS WITH NOTES** (F-2/F-3 projector-only; P2 covering-day vs later-typed older week). Privacy **PASS WITH NOTES**. UX **PASS WITH NOTES** (P1 SVG `role="img"` vs `tabIndex`, dead `is-inert`). Trust **FAIL** until Course used the same household as Standing. Verifier: rebase onto current `main` before merge; do not force-push this branch in this session.
- 2026-08-31 (trust repair): `sharedMonthCourse(booksHousehold, today)` so Register I and II share accepted books. Test: Fund-backed personal-scope recurrence leaves `course.freeToSpendCents === story.opening.freeToSpendCents` while the scoped clone still omits the reserve. Course SVG `role="figure"` with named keyboard markers. Add pad now pointer-locks the stage. Kitty rollover claim reads `booksHousehold`. Focused 3 files / 61 passed.
- 2026-08-31 (Standing contribution bars): Jonathan asked for a simple bar graph of member contributions in Standing's assay. `contributionsByMember` re-folds this month's `contribution-confirmed` events. Live Paper office: Bianca `$1,600.00`, Jonathan `$1,660.00`, both pine, scaled against `$3,400.00`. Proposals off the bar. `pnpm check` on `4b58785`: **1315 passed / 3 skipped**. UX `role="img"` note repaired to `role="group"`. Artifacts: `month_spread_contrib_bars_1440.png`, `_1100.png`, `_720.png`, `month_spread_contrib_bars_demo.mp4`. Classic desk does not show the Spread — Drawer → Paper office.

## Remaining uncertainty

- Forced-colors and reduced-motion CSS exist (`src/month-spread.css`); live Chrome Rendering emulation was not completed by automation.
- Attention and Change mosaic tiles still open panels the Spread absorbs — catalog question for Jonathan.
- Hero framing leads on Fund free-to-spend, not operating balance.
- trycloudflare demo dies when this agent VM stops. It is not `hearth-books` and must not be called live.
- Branch was cut from `origin/main@2a984fd`; `main` has since moved. Rebase before merge. Do not force-push unless Jonathan asks.
- F-2 covering-day stamp can hide a later-typed older-week miss (books P2). Jonathan owns that call.
- Confirmed future-dated Fund events are still omitted from the Course drawing (trust P1, not repaired this turn).

## Handoff

Next owner: Jonathan. Draft PR #259 on `cursor/month-spread-shared-home-04e5`. **Not merged, not deployed, not live.** F-2/F-3 wait on books review. Do not merge unless Jonathan asks.

## Decisions

- Apply onto current `main`, not `cursor/shared-ledger-story-aef7`. Kitchen desk already shipped via #252; Shared Home files are identical; `main` has later trust/performance/auth work the packet must not drop.
- Do not move `savedCents` on rollover (D-161). The shelf reports the claim.
- Do not merge F-2/F-3 without an independent books review.
