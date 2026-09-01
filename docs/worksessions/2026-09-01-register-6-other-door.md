# Hearth worksession — Register slice 6 other door

- **Status:** CLOSED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/register-6-other-door`
- **Baseline SHA:** `4c5b94320bd2d55c6b80411924abb2f0db2296a7`
- **Head SHA:** local Slice 6 commit (exact SHA is recorded in the external handoff because a commit cannot embed its own final hash)
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Whenever the Household Fund Ask is shown, offer a second, non-judgmental door: move an unfunded shared goal claim to next month and show the exact smaller Ask. Household bills are never offered as deferrable.

## Budget delta (5)

`+2`: the household can see the exact trade-off between this month's shared-goal claim and the remaining Ask without changing the register, moving money, or treating a bill as optional.

## Engagement delta (3)

`+1`: Ask presents a calm alternative to working or contributing more. No streak, pressure, ranking, notification, or automatic motion is added.

## Verified baseline

- Fact: `origin/main` was fetched and resolved to `4c5b94320bd2d55c6b80411924abb2f0db2296a7` before this worktree was created.
- Fact: this dedicated worktree began clean on `codex/register-6-other-door`, tracking that exact `origin/main`.
- Fact: Slice 5 attaches the exact FIFO `ContributionRegister` to each `HouseholdAsk`; the month Ask is `register.unfundedCents`.
- Inference to prove: deferring one partly or wholly unfunded goal claim lowers the Ask by that claim, floored at zero, while every non-goal obligation remains in the same shared-pool fold.

## Scope

### In scope

- Exported `AskAlternative` and pure `askAlternatives(ask)` in `src/core/ask.ts`.
- Goal-claim-only filtering, largest-claim-first deterministic ordering, exact cents, and exact copy.
- Canonical, bill-only, partial-funding, sorting, fail-closed, purity, and static source-fence tests.
- A D-161/D-173 why-note because the supplied draft's D-180 number is occupied by continuity-pilot canon.

### Out of scope

- UI, tap handling, motions, month mutation, goal rescheduling, commands, posting, allocation changes, contribution suggestions, member comparison, schema, hosted data, Auth/RLS, providers, secrets, Production, push, merge, and deployment.

## Acceptance evidence

- [x] Canonical `$340.00` Ask offers Halifax's `$300.00` claim and an Ask of `$40.00`.
- [x] Only partly or wholly unfunded `goal-claim` rows appear; bills and fully funded goals do not.
- [x] Alternatives sort by largest claim first with a deterministic tie break.
- [x] Exact copy is `Or move {goal} to next month, and the ask is {amount}.`
- [x] Untied registers and Ask/register cents mismatches fail closed; the input Ask is not mutated.
- [x] Focused tests, the serial books lane, TypeScript/builds, diff review, and independent books/verifier review pass. The aggregate Windows rerun's one unrelated synthetic-demo timeout passed immediately in isolation and is recorded below rather than hidden.

## Plan

- [x] Pin the exact clean baseline and inspect current canon/code.
- [x] Implement the bounded pure projector.
- [x] Add focused acceptance and adversarial proof.
- [x] Run local gates and independent read-only audits.
- [x] Close with exact state and next owner.

## Evidence log

- `git fetch origin main` and `git ls-remote origin refs/heads/main` both resolved the baseline to `4c5b94320bd2d55c6b80411924abb2f0db2296a7`.
- Dedicated worktree creation produced a clean `codex/register-6-other-door` branch at that exact baseline.
- Focused `ask-alternatives` + Ask/register/obligations/run-rate/Fund run after the fail-closed repair → 6 files, 50/50 tests passed.
- `pnpm exec tsc --noEmit` and `git diff --check` → passed.
- First full Windows gate before the final tamper guard → AI surface, 227 files passed / 2 skipped, 1,565 tests passed / 3 skipped, TypeScript, production Vite, Hercules Pro UI, and redirect guard passed.
- Final-state `pnpm check:windows` → AI surface passed; fast lane reached 212 files passed / 1 skipped and 1,444 tests passed / 2 skipped, with one unrelated `test/demo-suite.test.ts` profile case exceeding its 60-second limit; the required serial books lane still ran and passed 14 files / 120 tests with one file/test skipped. The check correctly returned failure before build.
- Immediate isolated `pnpm vitest run test/demo-suite.test.ts` → 1 file, 8/8 tests passed; the previously timed-out profile case completed in 44.586 seconds.
- Final-state direct `tsc --noEmit`, production Vite build, Hercules Pro UI build, and redirect guard → passed. Existing PGlite externalisation/eval/dynamic-import/chunk-size build warnings remained non-failing and outside this slice.
- Independent books review found one P1 in the initial projector: a caller could supply `askCents` that disagreed with its tied register. Repair requires safe nonnegative integer cents exactly equal to `register.unfundedCents` and derives the alternative from that verified value; tampered and negative regressions were added. Final books verdict: PASS, no P0/P1/P2/P3.
- Independent verifier reran the repaired focused suite, TypeScript, and diff check. Final verdict: PASS, no P0/P1/P2/P3.

## Decisions

- Alternatives are derived only from the attached register; `ask.ts` does not call the obligation projector or reallocate sources.
- A row is eligible only when the Ask cents still match its tied register, its canonical obligation id identifies a goal claim, and `unfundedCents > 0`.
- `askIfDeferredCents` is the current Ask minus the whole monthly claim, floored at zero. In a one-pool FIFO register, removing that obligation either removes its unfunded tail or releases funded cents to later rows.
- The supplied draft's D-180 collides with current continuity-pilot canon, so this behavior receives a D-161/D-173 one-pool why-note.

## Remaining uncertainty

- No goal is moved in this core slice. A later UI/motion slice must keep any tap proposal-only and require the existing household confirmation rule before changing a recurrence.
- The final aggregate Windows rerun was evidence-incomplete only because one existing long synthetic-demo case timed out under the four-worker lane; that exact file passed 8/8 immediately in isolation, and all Slice 6, books, type, and build evidence is green.

## Handoff

Local implementation is complete on `codex/register-6-other-door` from the named baseline. The slice adds a pure core projector and tests only; there is no UI or money-moving action. No PR, push, merge, deployment, hosted mutation, schema application, secret change, or Production action occurred. Jonathan is the next owner for any integration or later UI decision.
