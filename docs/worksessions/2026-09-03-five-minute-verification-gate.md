# Hearth worksession — Five-minute verification gate

- **Status:** CLOSED — LOCAL QUICK-GATE VERIFIED
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/five-minute-verification`
- **Baseline SHA:** `7dd1f96729fc9ec4fe6bb74a1daeacbf413b700a` (refreshed current main; work opened at `3bef5a391e8e0d9c3d93c7256ab7da9e27a89f67`)
- **Head SHA:** assigned by the single local implementation commit; exact SHA is reported in the final handoff
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Routine Medium through High-risk work gets current, change-focused proof in a five-minute target. Exhaustive proof no longer runs by default and cannot be mistaken for authorized release evidence.

## Budget delta (5)

`+1` assurance / `0` runtime. Faster feedback keeps trust-boundary work moving while retaining canaries and serial PGlite isolation.

## Engagement delta (3)

`0`. No household-facing behavior changes.

## Verified baseline

- Clean isolated worktree opened at `origin/main@3bef5a391e8e0d9c3d93c7256ab7da9e27a89f67`, then cleanly rebased when current main advanced to `7dd1f96729fc9ec4fe6bb74a1daeacbf413b700a` before handoff.
- The original OneDrive checkout is dirty with unrelated work and remains untouched.
- D-170 currently protects nineteen direct-PGlite/heavy fixtures in a serial full lane; `pnpm check` currently invokes that full suite and a production build.
- Automatic GitHub CI currently calls `pnpm check`.

## Scope

### In scope

- Quick and guarded-full command interfaces, focused selector, timing evidence, domain canaries, CI/manual workflow, policy contracts, canon, skills, and agent rule.

### Out of scope

- Runtime code, household data, hosted schema/rows, secrets, Production, push, merge, deployment, and execution of the exhaustive suite.

## Acceptance evidence

- [x] Quick/full command and workflow contract tests pass.
- [x] Ordinary selected tests remain bounded at four workers and selected PGlite tests remain serial.
- [x] Missing/mismatched proof, missing full authorization, Medium-risk full requests, dirty full worktrees, wrong SHA, unverified authorization records, and unresolved bases fail closed.
- [x] Medium, Medium-High, and High quick-gate runs each finish within five minutes.
- [x] Independent read-only review finds no path from ordinary commands or automatic CI to the exhaustive lanes.

## Plan

- [x] Verify clean current baseline and preserve dirty worktrees.
- [x] Implement the shared verification policy, quick runner, guarded full runner, and CI split.
- [x] Align canon, agent skills, and always-applied Cursor rule.
- [x] Run focused contracts and three representative quick gates; close evidence and handoff.

## Evidence log

- `pnpm exec vitest run test/verification-policy.test.ts test/test-lanes.test.ts --maxWorkers=1` — **19/19 passed**. Contracts cover quick/full routing, automatic-CI isolation, four-worker/serial selection, unrelated-test refusal, checked-in focus mapping, the live soft timer, owner actor and same-repository authorization validation, GitHub-record content verification, dirty full refusal, unresolved-base refusal, raw-coordinator refusal, and missing authorization.
- `pnpm exec tsc --noEmit` — passed. `pnpm ai:verify` — passed with 48 required files and the proof gate. `git diff --check` — passed; the remaining CRLF notices are Git line-ending notices, not whitespace errors.
- Medium: `pnpm test -- --risk=medium ...` — **quick-gate-passed in 19.722s**, 19/19 focused contracts, pre-refresh working-change fingerprint `e7c8d6179a700cef739af326c562525949b8a0cd75ba86bb206c28148f9636c5`, slowest phase TypeScript 12.403s, no SLA breach.
- Medium-High: same focused contract change with `--risk=medium-high` — **quick-gate-passed in 19.078s**, 19/19, same fingerprint, slowest phase TypeScript 11.614s, no SLA breach.
- High: `--risk=high` with the protected `test/proof-matrix.test.ts` books canary — **quick-gate-passed in 22.965s**, 19 ordinary tests at four workers plus 7 books tests serially, same fingerprint, slowest phase TypeScript 11.143s, serial phase 5.005s, no SLA breach.
- `pnpm test:full` without authorization refused before tests. Direct `scripts/run-test-lanes.mjs` has no package command and refuses even when the removed sentinel is forged. No exhaustive lane or production build ran.
- Two independent read-only audits initially found dirty-SHA, actor, unrelated-test, base, timeout-structure, authorization-record, and raw-lane bypasses. Those findings were repaired. The policy re-audit passed 17/17 before the final record-content/raw-command repairs; final verifier closure is recorded in the task handoff.

## Decisions

- D-202 supersedes D-170 only as the default invocation policy. D-170's complete lane membership and serial isolation remain the full-gate implementation.
- A transitive graph larger than twelve tests requires an applicable canary, checked-in mapping, or explicitly named focus with a reason; the gate records how many related tests were trimmed. A merely changed unrelated test never proves executable source.
- The five-minute limit is soft per Jonathan's selected preference: warn and finish the active phase, never claim the SLA.

## Remaining uncertainty

- GitHub's `full-verification` environment still needs Jonathan configured as required reviewer in repository settings. Code additionally binds dispatch to the owner account and verifies the cited owner-authored issue/PR/comment contains `full verification` plus the exact SHA, so a missing environment rule does not create an actor bypass. That live GitHub API path is contract-tested with synthetic responses but cannot be exercised without an actual future authorized High/Release request.

## Handoff

Local implementation only. Rollback is one commit reverting the tooling, workflow, rules, and canon; no runtime or hosted state exists to recover. Jonathan remains the decision owner for any later full run, push, merge, or deploy.
