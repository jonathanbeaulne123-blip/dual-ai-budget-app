# Hearth worksession — Migration hygiene (007 rename + apply)

- **Status:** CLOSED — 007 renamed, merged (#97), applied by Jonathan 2026-08-25
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Closed:** 2026-08-25
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/d126-007-applied-f375` (docs record)
- **Baseline SHA:** `a1b040e` → hygiene `0fe05be` → merge `f823c74`
- **PR:** #97 merged; follow-up docs PR this branch
- **Risk:** Medium (docs); hosted apply was Jonathan-owned
- **Decision owner:** Jonathan
- **Environment impact:** shared project CHECK relaxed; app Q2 C unchanged

## Household outcome

Hosted `households.timezone` CHECK matches local PGlite nonempty IANA. Books civil dates still require Toronto in the app.

## Budget delta (5)

`+1`

## Engagement delta (3)

`0`

## Acceptance evidence

- [x] `007_household_timezone_iana.sql` on `main` (unique prefix)
- [x] Jonathan applied 007 (2026-08-25)
- [x] Living docs record applied status
- [x] PRs #87 / #89 closed as superseded by #95

## Remaining

- 006 Auth/RLS cutover (Jonathan path B — shared project) still open; Google Auth + Production-guard revision required before apply

## Handoff

Jonathan: next is 006 path B prep (Google provider, bind memberships, revise Production abort or approve full-project cutover SQL).
