# Hearth worksession — onboarding lifecycle convergence repair

- **Status:** PR #358 OPEN — required checks pending
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/onboarding-lifecycle-convergence`
- **Baseline SHA:** `8eff077`
- **Implementation SHA:** `31a2a1b`
- **PR or issue:** [PR #358](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/358)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local test execution only

## Household outcome

A completed onboarding is no longer erased by an older Development forced-unlock replica. The escape hatch still wins when it is the genuinely newer fact. Corrupt household registry versions now receive one consistent repair answer from both the shaper and planner.

## Budget delta (5)

`+2`: protects accepted lifecycle metadata from stale replica convergence and makes the repair plan agree with accepted shaping.

## Engagement delta (3)

`+2`: prevents stale state from relocking ordinary Hercules or reopening Personal onboarding while preserving the intentional newer Development unlock.

## Verified baseline

- Fresh branch from current `origin/main@8eff077`.
- Before production edits, the new lifecycle coverage passed 17/23 and failed in the six reported places: stale forced unlock, undefined, null, string, fractional, and negative registry versions.
- The genuinely newer forced-unlock case passed before the fix.

## Scope

### In scope

- Compare a forced-unlock record's recency against the competing non-forced record before applying forced-state folding.
- Preserve forced-unlock semantics only when it is strictly newer.
- Normalize household registry versions through one pure reader shared by shaping and repair planning.
- Add bidirectional convergence and table-driven registry tests.

### Out of scope

- Money writers, accounts, transactions, journal/budget formulae, Funds, schema/migrations, hosted rows, Auth/RLS, providers/models, secrets, Production settings/data, fixture rewrites, exhaustive gates, browser/live use, push, merge, and deployment.

## Acceptance evidence

- [x] An older forced unlock cannot erase a newer completion in either merge argument order.
- [x] A newer forced unlock still wins over an older completion in either merge argument order.
- [x] Undefined, null, string, fractional, negative, older-integer, and current registry versions produce matching shaper/planner decisions.
- [x] Existing onboarding-mode and onboarding-progress suites pass without fixture edits.
- [x] Final High quick gate, TypeScript, production build, and AI-surface verification.

## Plan

- [x] Reproduce both convergence defects before production edits.
- [x] Make the smallest shared-authority repair.
- [x] Run focused lifecycle plus unchanged mode/progress coverage.
- [x] Complete the repository-required verification commands.
- [x] Hand off locally without push, merge, or deploy.

## Evidence log

- Pre-fix lifecycle run: 17/23 passed. Stale forced unlock returned `stopped-incomplete` with null completion fields; invalid non-integer versions planned `current`; negative version planned `fromVersion: -1` while shaping version 0.
- Post-fix focused run: 50/50 passed across lifecycle, onboarding-mode, and onboarding-progress. Neither existing mode nor progress fixture changed.
- Complete onboarding lane: 33 files and 481/481 assertions passed.
- High quick gate: 88/88 assertions passed in 98.557 seconds at fingerprint `32c025de7fbae8f219afbb01650dd8afed85bae41cfc74d5c5b7cab81cdfc007`; this includes 81 fast assertions, the seven-test serial trust matrix, TypeScript, AI-surface, discovery, and diff checks.
- `pnpm exec tsc --noEmit` passed. The host does not provide `npx`, so this is the repository-equivalent TypeScript invocation.
- `pnpm build` passed with 483 Vite modules plus Hercules Pro UI. Existing PGlite browser-externalization/eval, mixed-import, and large-chunk messages remained non-failing warnings.
- `pnpm ai:verify` passed: 48 required files, two Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.

## Decisions

- When exactly one side is forced, compare it with the non-forced row before entering the existing forced fold. An older or equal-time forced row is discarded; only a strictly newer forced row receives escape-hatch authority. Equal-time non-forced precedence is deterministic in both argument orders and avoids granting an unlock without a later fact.
- Normalize a present household onboarding record's version exactly as the shaper does: only a non-negative integer survives; everything else becomes 0. A wholly absent onboarding record remains `current` for migration purposes because there is no stored record to repair.

## Remaining uncertainty

- This is local synthetic/core evidence, not browser, hosted, authenticated two-device, deployment, or Production proof.
- No exhaustive suite is authorized or claimed.

## Handoff

Jonathan authorized push and merge. PR #358 now carries the single scoped branch; merge only after required checks pass on the exact reviewed head. Do not deploy or touch either Worker.
