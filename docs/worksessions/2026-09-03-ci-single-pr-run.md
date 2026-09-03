# Hearth worksession — Single-run pull-request CI

- **Status:** CLOSED — LOCAL QUICK-GATE VERIFIED
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/ci-single-pr-run`
- **Baseline SHA:** `f5a3cab8746d60131568768801d8145cd17f9a9b`
- **Risk:** Medium
- **Environment impact:** none

## Outcome

Each pull request runs one quick gate. Feature-branch pushes do not duplicate that work, while the independent post-merge `main` gate remains intact.

## Dual Course

- **Budget delta (5):** `+1` assurance throughput / `0` runtime.
- **Engagement delta (3):** `0`.

## Scope and boundaries

- Change only the automatic CI trigger, its regression contracts, and canon.
- Preserve quick-gate selection and canaries, manual authorized full verification, and post-merge `main` proof.
- No runtime, financial command, household data, hosted state, schema, secret, Production, push, merge, or deployment change.

## Acceptance

- [x] CI triggers on pull requests and pushes to `main` only.
- [x] Policy tests and AI-surface verification refuse duplicate agent-branch push triggers.
- [x] The Medium quick gate passes within five minutes.

## Evidence

- `pnpm exec vitest run test/verification-policy.test.ts --maxWorkers=1` — **18/18 passed**.
- `pnpm check -- --risk=medium --focus=test/verification-policy.test.ts --focus-reason="CI trigger de-duplication contract"` — **quick-gate-passed in 21.322s**, 19/19 selected tests, TypeScript and AI-surface verification passed, no SLA breach. Working-change fingerprint: `2903fb99f69d766761ece58b75ce428eaf061fe6bdd40c0e4fa54c59866c6137`.
- No full suite, build, browser smoke, hosted operation, push, merge, or deployment ran.

## Rollback

Revert the workflow, policy assertions, and documentation commit. No runtime or hosted state requires recovery.
