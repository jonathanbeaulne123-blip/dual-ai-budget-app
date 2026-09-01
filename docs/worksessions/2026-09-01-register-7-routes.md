# Hearth worksession — Register slice 7 routes

- **Status:** CLOSED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/register-7-routes`
- **Baseline SHA:** `c2f6c91fe3cb1a4534455e7ac323b982a9bd24f0`
- **Head SHA:** local Slice 7 commit (exact SHA is recorded in the external handoff because a commit cannot embed its own final hash)
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Translate a Household Fund Ask into a few optional shift combinations grounded only in the member's posted work pattern. Refuse to guess before four posted shifts, headline the conservative tip floor, and never pressure a member to work.

## Budget delta (5)

`+3`: the household can compare an Ask with conservative, history-grounded shift projections while expected tips remain secondary and no projected money enters the books.

## Engagement delta (3)

`+2`: calm routes and one honest near miss make the Ask more usable without streaks, notifications, imperative language, or automatic calendar action.

## Verified baseline

- Fact: this dedicated worktree began clean at Slice 6 commit `c2f6c91fe3cb1a4534455e7ac323b982a9bd24f0`.
- Fact: `origin/main` was `4c5b94320bd2d55c6b80411924abb2f0db2296a7`; Slice 7 intentionally depends on the local, unmerged Slices 5 and 6 lineage.
- Fact: `weekdayCadenceMap` derives weekdays, meal, and hours from posted tip shifts, while `shiftOutlook` provides low/p10 and expected/p50 projections without posting.
- Inference to prove: bounded combinations of those exact candidate shifts can be ranked by the conservative floor without inventing workdays, presenting p50 as available money, or coercing a member.

## Scope

### In scope

- Exported pure `askRoutes` projector and Slice 7 types.
- Posted-cadence candidates, existing shift outlook pricing, conservative ranking, a bounded near miss, and exact copy.
- Canonical, refusal, ordering, copy, purity, range, and static safety-fence tests.
- D-161/D-173 why-note because the supplied draft's D-181 number is occupied by Add-slideshow canon.

### Out of scope

- UI, route taps, calendar changes, shift proposals, commands, posting, contribution logic, work-pay amounts, notifications, schema, hosted data, Auth/RLS, providers, secrets, Production, push, merge, and deployment.

## Acceptance evidence

- [x] Twelve posted shifts plus a `$340.00` Ask returns a top route that clears at the safe floor with the fewest hours.
- [x] Fewer than four posted shifts returns the exact not-enough-data copy and no routes.
- [x] Every candidate date uses a weekday present in the member's posted cadence; routes and shifts are each capped at four.
- [x] Safe/p10 cents drive clearing and ranking; expected/p50 cents remain a secondary whisker only.
- [x] Results sort clear first, then fewest hours, fewest shifts, and earliest finish, with one plausible lower-cost near miss when available; the monthly search is hard-capped at 31 days.
- [x] The projector is pure and contains no posting, calendar suggestion, or imperative work copy.
- [x] Focused, books, type/build, full Windows, and independent reviews pass.

## Plan

- [x] Pin the exact clean baseline and inspect current canon/code.
- [x] Implement the bounded pure route projector.
- [x] Add focused acceptance and adversarial proof.
- [x] Run local gates and independent read-only audits.
- [x] Close with exact state and next owner.

## Evidence log

- `git status`, `git rev-parse HEAD`, and `git ls-remote origin refs/heads/main` established the clean Slice 6 baseline and current main before branch creation.
- Final focused Slice stack (`ask-routes`, alternatives, Ask, register, run-rate, obligations, Fund) → 7 files, 57/57 tests passed; `tsc --noEmit` and diff check passed.
- Final Windows gate → AI surface passed; fast lane 214 files passed / 1 skipped and 1,452 tests passed / 2 skipped; serial books lane 14 files passed / 1 skipped and 120 tests passed / 1 skipped. TypeScript and the production Vite build passed with the existing PGlite externalisation/eval/dynamic-import/chunk warnings only. The silent Hercules UI builder and redirect guard were rerun directly and passed.
- The initial implementation retained and globally sorted up to 597,618 combinations over 62 days. Three independent reviewers identified the client-side boundedness defect. The repair now selects leaders online, keeps a bounded near-miss frontier, prunes provably dominated candidates, and hard-caps the monthly horizon at 31 days (36,456 visits even if no candidate prunes).
- The 31-day all-weekday stress case and 32-day refusal pass. Final independent books, trust/privacy, and acceptance reviews each report PASS with no P0/P1/P2/P3 findings.
- Final scope review found only the pure core projector/export, tests, worksession, and decision why-note; no UI, command/writer, calendar action, schema, hosted/Auth/RLS, provider, secret, Production, or deployment path changed.

## Decisions

- Risk is High because this read-only projection translates a household funding gap into possible paid work. The safe-versus-expected distinction and non-coercive language are trust boundaries even though no writer is added.
- Slice 7 consumes Slice 6 locally because the supplied dependency graph requires Slices 5 and 6 first; integration remains separately gated.
- A route window is monthly and capped at 31 inclusive civil dates. This covers the whole primary Ask month, bounds synchronous phone work, and refuses broader calls rather than silently sampling them.
- Expected/p50 cents are retained only for the visual whisker. Clearing, ordering, spare, and shortfall all use safe/p10 cents.

## Remaining uncertainty

- This core slice does not render the routes or create calendar/shift proposals. A later surface must call it within the 31-day monthly window, keep the refusal amount visible, and preserve proposal-first/Confirm-only behavior.

## Handoff

Local Slice 7 implementation is complete on `codex/register-7-routes`, based on the named local Slice 6 commit. No push, merge, deployment, hosted mutation, schema application, secret change, or Production action occurred. Jonathan is the next owner for integration approval or the later UI slice.
