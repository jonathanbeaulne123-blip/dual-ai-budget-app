# Hearth worksession — Household timezone + Add location

- **Status:** OPEN (awaiting Jonathan Q1–Q8 locks)
- **Opened:** 2026-08-24 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/household-timezone-location-f375`
- **Baseline SHA:** `51e59df0c5d549ce1fbc1f104ccb1e710209052c`
- **Head SHA:** (pending commit)
- **PR or issue:** (pending)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development local PGlite schema v2; hosted 004 unapplied

## Household outcome

Civil posting dates follow a household-chosen IANA timezone. Add can optionally stamp real capture time and coordinates after a phone-local location opt-in. Confirm still posts. Jonathan locks all user-facing product choices.

## Budget delta (5)

`+2`

## Engagement delta (3)

`+1`

## Acceptance evidence

- [x] Non-Toronto IANA accepted for postEntry / Health
- [x] Location stamp + AI strip tests
- [x] `pnpm test` 416/416
- [x] `tsc --noEmit` clean
- [ ] Jonathan answers Q1–Q8
- [ ] Jonathan applies hosted 004 if cloud upsert of non-Toronto is required

## Evidence log

- `pnpm test` → 416 passed
- `pnpm exec tsc --noEmit` → clean
- Product questions: `docs/briefs/TIMEZONE_LOCATION_PRODUCT_QUESTIONS.md`

## Decisions

D-126 provisional; Q1–Q8 await Jonathan.

## Remaining uncertainty

Hosted CHECK still Toronto-only until 004 applied. Weather remains Toronto coords (Q7 A).

## Handoff

Jonathan: answer Q1–Q8, then review PR. Do not merge as final UX until locks land.
