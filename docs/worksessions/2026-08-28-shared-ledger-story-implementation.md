# Hearth worksession — Shared Ledger story implementation

- **Status:** OPEN; draft PR ready for review
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/shared-ledger-story-aef7`
- **Baseline SHA:** `871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65`
- **Head SHA:** `dc00c39` (D-164 kitchen notes + leftover CAD fence; docs SHA follows this line)
- **PR or issue:** draft [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244)
- **Risk:** High review gate (ledger-mode privacy and financial presentation)
- **Decision owner:** Jonathan
- **Environment impact:** none; local/synthetic Development only

## Household outcome

Opening Shared Ledger feels like sitting down at the household table: what is true together, what changed, what needs a person, what is next, and why the view is trustworthy. Opening Personal Ledger feels like a private folio, not the Shared room with a filter. Desktop and iPad share one story/folio system at `>=720px`. iPhone keeps `OfficePhone` structure.

## Budget delta (5)

`+4` — mode-safe projectors, Fund flow that matches D-161, authority in the journey, route-wide Personal denial, persist/compile on the accepted snapshot.

## Engagement delta (3)

`+3` — cooperative weekly/monthly paper story instead of disconnected Fund forms.

## Verified baseline

- `origin/main` is `871e660` (merged D-164 design packet PR #242).
- Implementation landed on this branch; P0 persist/privacy follow-up is in `4c1b27f` / `ee74045`.

## Scope

### In scope

- `projectLedgerExperience`, `ledgerRouteContract`, Shared Story and Personal Folio projectors.
- Desktop/iPad Shared Story and Personal Folio compositions.
- Route-level mode openings for Books, Plan, Calendar, Shift, Accounts, More, Add/Confirm.
- Progressive disclosure of existing Fund commands. No new money formulas.
- Phone semantic labels only.
- Presentation-only scoped household; writers on accepted snapshot.

### Out of scope

- New Fund event kinds, custodian/refund/settlement/reserve/deficit changes.
- Schema, provider, secrets, hosted mutation, Production, merge, deploy.
- iPhone structural redesign.

## Acceptance evidence

- [x] Mode switch changes Home/Books purpose and next actions, not only figures.
- [x] Canonical Fund arithmetic through flow nodes (focused tests).
- [x] Shared denial of Bianca’s private backing/recon facts in projectors/export; Add pickers scoped.
- [x] Desktop/iPad story at 1280 and ~768; phone 320/390 unchanged structurally (purpose banner only).
- [x] Focused tests + `pnpm check` at `dd4fe43` (1100 passed / 2 skipped).
- [x] Home sit-down, Shared Fund CAD, and Books journal compile from `booksHousehold`.

## Plan

- [x] Open worksession from exact `origin/main`.
- [x] Slice 0: mode projectors and route tests.
- [x] Slice 1: Shared Story / Fund flow / queue / weekly / monthly / trust.
- [x] Slice 2: desktop/iPad Shared Home.
- [x] Slice 3: Shared deep pages and Fund progressive disclosure.
- [x] Slice 4: Personal Folio and privacy denial.
- [x] Slice 5: phone semantic correction only.
- [x] P0 persist/privacy wiring after independent audit.
- [x] Audit follow-up: Home sit-down / Fund CAD / Books journal on accepted books; Fund free-to-spend copy; purpose copy hidden below 720px; Shared due Confirm posts visible ids only.
- [ ] Jonathan review of draft PR; independent auditor notes on this SHA.

## Evidence log

- 2026-08-28: branched `cursor/shared-ledger-story-aef7` from `origin/main@871e660`.
- 2026-08-28: `6c8bb18` implement story/folio; `61f0ec5` restore Fund disclosure CSS.
- 2026-08-28: `4c1b27f` persist/compile on accepted snapshot; scoped Add pickers; redacted Health; fail-closed export.
- 2026-08-28: `ee74045` Plan `fundGoal` source fence.
- 2026-08-28: `d2a4a93` docs handoff for draft PR #244.
- 2026-08-28: `5b424f4` Home sit-down, Shared Fund CAD, Books journal on accepted books; Fund pane **Fund free-to-spend**; Office health from `integrityFindings`.
- 2026-08-28: `dd4fe43` Shared due Confirm posts only visible recurrence ids; Personal Rec does not default to Shared chart.
- 2026-08-28: `pnpm check` at `dd4fe43` → 1100 passed / 2 skipped; build green.
- 2026-08-28: localhost demo kitchen as Jonathan; Shared Home 1280, Books Fund pane, phone 320 purpose heading.
- 2026-08-29: ChatGPT independent-review packet [`briefs/CHATGPT_D164_INDEPENDENT_REVIEW_2026-08-29.md`](../briefs/CHATGPT_D164_INDEPENDENT_REVIEW_2026-08-29.md). Model: GPT-5 Pro. Not a merge/deploy gate by itself.
- 2026-08-29: Jonathan confirmed kitchen notes. `82a4ae9` implements Kitty Banks (replaces Plan Goals), Shared Home without Month hero, sit-down chart cycling, Calendar cell titles, Personal Books nav, Home scroll, Hercules cream bubble, Shift posted earnings.
- 2026-08-29: `pnpm check` at `82a4ae9` → **1108 passed / 2 skipped**; build green.
- 2026-08-29: `1e3d31b` leftover CAD off Personal Ask/help/overlay; sit-down leftover from books; `goalVisibleInView`; `pnpm check` **1109 passed / 2 skipped**.
- 2026-08-29: `dc00c39` Books Ask passes `{ memberId, view }`; per-bank Kitty contribution amounts; `pnpm check` **1109 passed / 2 skipped**.
- 2026-08-29: Visual walk (demo kitchen as Jonathan): Shared Home 1100, Plan Kitty Banks, Calendar titles, Personal Books nav, Shift posted earnings, OfficePhone 390. Video `kitchen_shared_personal_walkthrough.mp4`.

## Decisions

- Presentation uses `projectLedgerExperience` scoped household; commands and Health still run on the accepted snapshot.
- Personal presentation accounts are member-owned `scope: personal` only; shared account catalog stays in Shared.
- iPhone keeps Fund glance only when the Fund exists; wide Shared puts story tiles on the desk mosaic and the notebook, not a second stacked paper room.
- `restoreAcceptedSnapshot` is a persist safety net for presentation clones; close/rec/setBudget/addGoal still execute on `booksHousehold`.
- Shared Books is not a general-ledger landing: Fund operating + household cash/credit open the page; trial/statements/net worth stay in Audit. Books is a deep page from More, not Shared primary nav.
- Shared keeps the deep room as **Household table**, not Books: table tiles are Fund, chequing, goal savings, and cards; investments stay in Wallet/Audit; Shared Audit is a closed disclosure. Personal still opens on net worth / My books.
- Kitty Banks remains D-161 (Fund surplus into existing shared goals). Jonathan confirmed Plan Goals is replaced by Kitty Banks on Shared and Personal.

## Phone audit (Slice 5)

Semantic correction implemented: Plan and More still show `LedgerPurposeBanner`. Home, Calendar, Shift, and Books carry their own heading so the purpose card does not steal the fold. The existing Fund glance remains phone-only (`is-phone-only`) and is labeled Fund free-to-spend when the Fund exists. `OfficePhone` structure, seals, mosaic count, and notebook rule stay; App-level nav follows Shared vs Personal jobs (no Shift/Books on Shared primary).

## Remaining uncertainty

- A real multi-week Fund household has not been visually audited; tests use synthetic D-161 fixtures.
- Demo seed has few `scope: personal` accounts, so Personal folio/wallet charts may be thin.
- Plan Kitty **Fund bank** posts via `fundGoal` without a Confirm sheet (books auditor P1).
- Afford/food Ask can still recite cash-like CAD on Personal; leftover assignment questions are gated.
- Independent leftover-CAD re-audit after `dc00c39` (Books Ask fence) was not a second privacy pass.
- Do not rebase onto later `main` unless Jonathan asks.

## Handoff

Next owner: Jonathan reviews the confirmed kitchen notes on draft PR #244 (`dc00c39`). Branch kitchen is not the live Worker. Not merged, not deployed. Do not rebase onto later `main` unless asked.
