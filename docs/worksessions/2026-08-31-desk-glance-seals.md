# Hearth worksession — Glance plates, seal lists, scrolling month sheet

- **Status:** CLOSED; MERGED #265; KITCHEN PUBLISHED
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `main` (from `cursor/desk-glance-seals-021f`)
- **Baseline SHA:** `2690c57` (`origin/main` at cut); merged through `origin/main@d29d2d6` (D-187/D-188)
- **Head SHA:** `7d01b62e79041d294e7b9dfc372fc1df6e28df05` (merge of #265)
- **PR or issue:** merged [#265](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/265)
- **Risk:** High presentation, then Release because Jonathan ordered merge/deploy
- **Decision owner:** Jonathan ordered push/merge/deploy 2026-09-01
- **Environment impact:** Development kitchen URL via `hearth-books` `wrangler deploy`. No Production, hosted mutation, schema apply, or secrets

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
- Jonathan confirmed four notes on 2026-08-31, then confirmed again to finish the packet.
- `origin/main` moved through D-187 and D-188 while the branch was open; both were merged in before kitchen publish.

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
- Merge to current `main` and D-041 kitchen deploy after Jonathan's order.

### Out of scope

- Leftover spend seal (stays Plan).
- iPhone `OfficePhone` destination (stays blotter).
- Fund math, Kitty restyle, schema, Production.

## Acceptance evidence

- [x] Glance copy; open shows figure, footing, Cabinet
- [x] Click no longer replaces the month sheet
- [x] Money in / out lists this month; display only
- [x] Stage height token matches three open plate rows
- [x] Focused plates + Bianca startup/rehearsal on `7d01b62`: **30 passed**
- [x] `pnpm check` on `7d01b62`: **1449 passed / 3 skipped**
- [x] Merged #265; kitchen `wrangler deploy` verified HTTP 200 with live `Office-BC-mxQLw.js`

## Plan

- [x] Glance field + expand state
- [x] Seal month lists
- [x] Stage scroll height
- [x] Tests, check, draft PR, browser proof
- [x] Merge, kitchen publish, live markers

## Evidence log

- 2026-08-31: Jonathan confirmed the four-note packet. Branched from `origin/main@2690c57`.
- 2026-08-31: Implementation on `3e1398e`. `pnpm check` 1441 passed / 3 skipped; Vite 384 modules; Hercules Pro UI green.
- 2026-08-31: Browser on fictional Development demo: 1100 open plate + month sheet; Money in posted list; 720 stacked; 390 phone seals still present; leftover spend → Plan.
- 2026-08-31: Independent UX audit: keep with reshapes; seal `aria-pressed` now toggles off on a second click.
- 2026-08-31: Jonathan confirmed again to finish the packet.
- 2026-09-01: Jonathan: “push merge and deply”. Integrated `origin/main@d29d2d6`. Merged #265 as `main@7d01b62`.
- 2026-09-01: Cloudflare Workers [`33460617226`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33460617226) success. Worker `0a9ceae5-6227-409c-8121-dc964631b1e5`. Live HTML `Cache-Control: no-store`; `index-Cdc4gCTV.js` → `Office-BC-mxQLw.js` with glance expand, “Income this month” / “Expenses this month”, `month-posted-list`, leftover-spend footing, and no plate-on-stage. CSS `--stories-open-height: calc(680px + 2.2rem)`.

## Decisions

- Multi-open left cards. Height ruler is six open, not the current collapsed stack.
- Expense list follows `partitionLedger`: refunds are not expenses.
- A second tap on the open Money in / Money out seal closes the list.

## Remaining uncertainty

- Live forced-colors / reduced-motion DevTools.
- At stacked widths the stage sits under the mosaic; the same height cap still applies.
- Phone Money in blotter body sits below the story strip; a computer-use pass did not always catch the notebook after the seal click, but `OfficePhone` still calls `tapSeal("blotter")`.
- Main CI `33460617301` was still running at kitchen-proof time.

## Handoff

Next owner: Jonathan. Hard-refresh `https://hearth-books.jonathan-beaulne123.workers.dev/` on a wide Paper office Home. Leftover spend still Plan. Phone seals still blotter. **Merged and kitchen-published.** Not Production. Do not treat a Cloudflare preview alias as the kitchen.
