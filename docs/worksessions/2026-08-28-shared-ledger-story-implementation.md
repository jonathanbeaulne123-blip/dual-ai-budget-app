# Hearth worksession — Shared Ledger story implementation

- **Status:** OPEN; draft PR ready for review
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/shared-ledger-story-aef7`
- **Baseline SHA:** `871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65`
- **Head SHA:** `5b424f4bb6508a89d24ffea8291f0ec2bc1b65a4`
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
- [x] Focused tests + `pnpm check` at `5b424f4` (1099 passed / 2 skipped).
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
- [x] Audit follow-up: Home sit-down / Fund CAD / Books journal on accepted books; Fund free-to-spend copy; purpose copy hidden below 720px.
- [ ] Jonathan review of draft PR; independent auditor notes on this SHA.

## Evidence log

- 2026-08-28: branched `cursor/shared-ledger-story-aef7` from `origin/main@871e660`.
- 2026-08-28: `6c8bb18` implement story/folio; `61f0ec5` restore Fund disclosure CSS.
- 2026-08-28: `4c1b27f` persist/compile on accepted snapshot; scoped Add pickers; redacted Health; fail-closed export.
- 2026-08-28: `ee74045` Plan `fundGoal` source fence.
- 2026-08-28: `d2a4a93` docs handoff for draft PR #244.
- 2026-08-28: `5b424f4` Home sit-down, Shared Fund CAD, Books journal on accepted books; Fund pane **Fund free-to-spend**; Office health from `integrityFindings`.
- 2026-08-28: `pnpm check` at `5b424f4` → 1099 passed / 2 skipped; build green.
- 2026-08-28: localhost demo kitchen as Jonathan; Shared vs Personal visual proof.

## Decisions

- Presentation uses `projectLedgerExperience` scoped household; commands and Health still run on the accepted snapshot.
- Personal presentation accounts are member-owned `scope: personal` only; shared account catalog stays in Shared.
- iPhone keeps Fund glance only when the Fund exists; wide Shared replaces it with the story room.
- `restoreAcceptedSnapshot` is a persist safety net for presentation clones; close/rec/setBudget/addGoal still execute on `booksHousehold`.

## Phone audit (Slice 5)

Semantic correction implemented: every tab, including phone Home, shows `LedgerPurposeBanner` with the active ledger purpose. The existing Fund glance remains phone-only (`is-phone-only`) and is labeled Fund free-to-spend when the Fund exists; wide Shared replaces it with the story room. `OfficePhone` structure, seals, mosaic count, notebook rule, and nav are unchanged.

## Remaining uncertainty

- A real multi-week Fund household has not been visually audited; tests use synthetic D-161 fixtures.
- Demo seed has no `scope: personal` accounts, so Personal Books compile empty.
- 820/1024/1440 stills were not captured as separate files.
- Independent books/privacy/UX auditor return on `5b424f4` should be read before merge (prior books FAIL was Home sit-down on the presentation clone).

## Handoff

Next owner: Jonathan reviews draft PR #244. Not merged, not deployed, not live.
