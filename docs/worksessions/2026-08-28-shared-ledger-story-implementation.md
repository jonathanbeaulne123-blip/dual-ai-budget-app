# Hearth worksession — Shared Ledger story implementation

- **Status:** OPEN
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/shared-ledger-story-aef7`
- **Baseline SHA:** `871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65`
- **Head SHA:** (in progress)
- **PR or issue:** none yet
- **Risk:** High review gate (ledger-mode privacy and financial presentation)
- **Decision owner:** Jonathan
- **Environment impact:** none; local/synthetic Development only

## Household outcome

Opening Shared Ledger feels like sitting down at the household table: what is true together, what changed, what needs a person, what is next, and why the view is trustworthy. Opening Personal Ledger feels like a private folio, not the Shared room with a filter. Desktop and iPad share one story/folio system at `>=720px`. iPhone keeps `OfficePhone` structure.

## Budget delta (5)

`+4` planned — mode-safe projectors, Fund flow that matches D-161, authority in the journey, route-wide Personal denial.

## Engagement delta (3)

`+3` planned — cooperative weekly/monthly paper story instead of disconnected Fund forms.

## Verified baseline

- `origin/main` is `871e660` (merged D-164 design packet PR #242).
- `displayHousehold` is still asymmetric: Shared Home/Books get `householdForView`; Personal receives the accepted full household.
- Calendar, Shift, More, and JSON export receive the raw accepted household.
- Fund glance sits above Office and is absent before setup. Fund panel is form-first.
- `test/household-fund-ui.test.ts` still fences Fund out of the Office instrument model.

## Scope

### In scope

- `projectLedgerExperience`, `ledgerRouteContract`, Shared Story and Personal Folio projectors.
- Desktop/iPad Shared Story and Personal Folio compositions.
- Route-level mode openings for Books, Plan, Calendar, Shift, Accounts, More, Add/Confirm.
- Progressive disclosure of existing Fund commands. No new money formulas.
- Phone semantic labels only.

### Out of scope

- New Fund event kinds, custodian/refund/settlement/reserve/deficit changes.
- Schema, provider, secrets, hosted mutation, Production, merge, deploy.
- iPhone structural redesign.

## Acceptance evidence

- [ ] Mode switch changes Home/Books purpose and next actions, not only figures.
- [ ] Canonical Fund arithmetic through flow nodes.
- [ ] Shared denial of Bianca’s private backing/recon facts.
- [ ] Desktop/iPad story at 768/820/1024/1280/1440; phone 320/390 unchanged structurally.
- [ ] Focused tests + `pnpm check`.

## Plan

- [x] Open worksession from exact `origin/main`.
- [x] Slice 0: mode projectors and route tests.
- [x] Slice 1: Shared Story / Fund flow / queue / weekly / monthly / trust.
- [x] Slice 2: desktop/iPad Shared Home.
- [x] Slice 3: Shared deep pages and Fund progressive disclosure.
- [x] Slice 4: Personal Folio and privacy denial.
- [x] Slice 5: phone semantic correction only.
- [ ] Independent books/privacy and UX audits; handoff.

## Evidence log

- 2026-08-28: branched `cursor/shared-ledger-story-aef7` from `origin/main@871e660`.

## Decisions

- Presentation uses `projectLedgerExperience` scoped household; commands and Health still run on the accepted snapshot.
- Personal presentation accounts are member-owned `scope: personal` only; shared account catalog stays in Shared.
- iPhone keeps Fund glance; wide Shared replaces it with the story room.

## Phone audit (Slice 5)

Semantic correction implemented: every tab, including phone Home, shows `LedgerPurposeBanner` with the active ledger purpose. The existing Fund glance remains phone-only (`is-phone-only`); wide Shared replaces it with the story room. `OfficePhone` structure, seals, mosaic count, notebook rule, and nav are unchanged.

Recommendations not implemented (need new approval):

- After Fund setup, a one-line Fund free-to-spend inside the existing phone story strip would couple Dual Course without a new instrument.
- iPad Hercules/nav overlay collision is mitigated with story padding; a later OfficeWide z-index pass could still help.
- Personal phone Home still uses OfficePhone atmosphere under the folio-less phone fence; that is intentional.

## Remaining uncertainty

- A real multi-week Fund household has not been visually audited; tests use synthetic D-161 fixtures.
- Quiet appointments use `sensitivity: "quiet"`; Shared hides them, Personal shows the member’s own.

## Handoff

Next owner: Cursor until the implementation PR is reviewable. Jonathan decides push-beyond-this-agent, merge, and deploy. Not merged, not deployed, not live.
