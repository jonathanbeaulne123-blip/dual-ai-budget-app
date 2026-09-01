# Hearth worksession — Register slice 5 Ask

- **Status:** CLOSED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/register-5-ask`
- **Baseline SHA:** `86da91c2fc16912c2f56dcf62d2dd53e2a8429be`
- **Head SHA:** local Slice 5 commit (exact SHA is recorded in the external handoff because a commit cannot embed its own final hash)
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Say the Household Fund register's remaining monthly shortfall in one calm sentence, with a secondary view of the same fold through the custodian's next scheduled payday.

## Budget delta (5)

`+3`: the household can read the register's exact unfunded tail without a second financial calculation. No posting, balance, allocation, or contribution-amount assumption changes.

## Engagement delta (3)

`+1`: a concise month/payday explanation makes the register easier to return to. No streak, notification, reward, or pressure mechanic is added.

## Verified baseline

- Fact: `origin/main` was fetched and resolved to `86da91c2fc16912c2f56dcf62d2dd53e2a8429be` before this worktree was created.
- Fact: this dedicated worktree began clean on `codex/register-5-ask`, tracking that exact `origin/main`.
- Fact: `contributionRegister` is the current FIFO source/obligation fold; `houseRunRate` supplies `watching | provisional | settled`; Work jobs carry `WorkPaySchedule` timing.
- Inference to prove: a bounded through-date register projection can serve the payday horizon without duplicating obligation arithmetic in `ask.ts`.

## Scope

### In scope

- Pure `householdAsk` and `nextPaydayDate` projectors.
- Reuse of register, run-rate confidence, and existing pay cadence timing.
- A bounded through-date entry point in the register if required to preserve one fold.
- Focused tests, core export, and a D-161/D-173 why-note because draft decision D-179 is already occupied.

### Out of scope

- UI, routes, reminders, contribution suggestions, ratios, member comparisons, commands, posting, schema, hosted data, providers, secrets, Production, push, merge, and deployment.

## Acceptance evidence

- [x] Month Ask is exactly `register.unfundedCents`, including the canonical `$340.00` shortage.
- [x] Covered months return zero and exact covered copy.
- [x] Payday Ask uses the custodian's next existing pay cadence and a register truncated at that date, with no assumed contribution amount.
- [x] Watching confidence preserves the Ask and exact caveat.
- [x] `ask.ts` imports and reads the register and contains no obligation arithmetic.
- [x] Focused tests, TypeScript, full Windows gate, complete diff, and independent books/verifier review pass.

## Plan

- [x] Pin the exact clean baseline and inspect current canon/code.
- [x] Implement one reusable through-date register fold and the Ask projector.
- [x] Add focused acceptance and adversarial tests.
- [x] Run local gates and independent read-only audits.
- [x] Close with exact state and next owner.

## Evidence log

- `git fetch origin main` → `origin/main@86da91c2fc16912c2f56dcf62d2dd53e2a8429be`.
- Dedicated worktree creation → clean `codex/register-5-ask` at the exact baseline.
- `pnpm vitest run test/ask.test.ts test/contribution-register.test.ts test/house-run-rate.test.ts test/month-obligations.test.ts test/household-fund.test.ts` → 5 files, 43/43 tests passed.
- `pnpm exec tsc --noEmit` → passed.
- `git diff --check` → passed (Git reported only expected LF/CRLF notices on existing tracked files).
- `pnpm check:windows` → AI surface passed; 224 files passed / 2 skipped; 1,542 tests passed / 3 skipped; TypeScript, production Vite build, Hercules Pro UI build, and redirect guard passed. Existing React `act(...)` warnings remained non-failing and outside this core-only slice.
- Independent books audit found one P1 in the initial cadence route: `projectCadence` stops advancing an old anchor after 48 intervals. Repair routes every `WorkPaySchedule` through `nextWorkScheduleDate` and adds weekly/biweekly 2024-anchor regressions. Final books audit: PASS, no P0/P1/P2.
- Independent verifier reran the repaired focused suite, TypeScript, and diff checks: PASS, no P0/P1/P2.

## Decisions

- The month horizon remains primary and returns the existing complete-month register unchanged.
- A missing custodian payday must not be fabricated; the projector will retain the month horizon rather than invent timing.
- Payday timing uses the existing `nextWorkScheduleDate` matcher for all `WorkPaySchedule` cadences; pay and contribution amounts are never read.
- Draft D-179 collides with current synthetic-investor canon, so the behavior is recorded as a D-161/D-173 one-pool why-note.

## Remaining uncertainty

- No code finding remains. Slice 5 is core-only; UI placement is intentionally deferred to later Register & Ask slices.
- Push, merge, deployment, and any live-client claim remain separately gated and unperformed.

## Handoff

Local implementation is complete on `codex/register-5-ask` from the named baseline. Changed files are `src/core/ask.ts`, `src/core/contributionRegister.ts`, `src/core/index.ts`, `test/ask.test.ts`, `docs/DECISIONS.md`, and this worksession. No PR, push, merge, deployment, hosted mutation, schema application, secret change, or Production action occurred. Jonathan is the next owner for any integration decision.
