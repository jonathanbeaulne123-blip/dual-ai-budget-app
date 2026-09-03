# Hearth worksession — onboarding semantic actions

- **Status:** PR OPEN
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/4-actions`
- **Baseline SHA:** `48514441731e7cf2c53b152fe6867b3cfaa39058`
- **Head SHA:** implementation `4e7a716efae8856046ebc3edda25a1e34954c22a`; worksession closure follows
- **PR or issue:** [#321](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/321)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Short affirmative replies may advance or resume onboarding without ever becoming approval, submission, editing, navigation, setup-stop, or personal-skip authority.

## Budget delta (5)

`+2`: typed intent is fail-closed, revision-bound actions reject stale state, and the resolver cannot mutate household or money state.

## Engagement delta (3)

`+2`: a small local phrase set makes calm continuation conversational while every permitted `continue` retains a button path.

## Verified baseline

- The clean branch begins at `origin/main@48514441731e7cf2c53b152fe6867b3cfaa39058`, including the corrected onboarding slice 3.
- The registry already declares nine semantic action kinds and the chapters that permit `continue`.
- Slice 3 supplies member-owned progress and typed completion; no action resolver or affirmative classifier exists.
- Inference to prove: typed affirmation can resolve only local continuation actions without importing or bypassing the command layer.

## Scope

### In scope

- A versioned, local, English/Canadian-English affirmative classifier with the exact slice truth table.
- A pure semantic-action resolver with affirmative allow-list, revision fence, and command/local/refused outcomes.
- All eighteen action-kind/origin combinations, revision, idempotence, import fence, and registry-button tests.
- Core exports and D-206.

### Out of scope

- UI, rendering, copy surfaces, command execution, accepted probe writes, model/provider calls, money behavior, schema, hosted data, Production, merge, and deployment.

## Acceptance evidence

- [x] Full affirmative truth table passes.
- [x] All 18 action/origin combinations pass.
- [x] Submit, approve, and edit refuse missing/stale revisions.
- [x] Replay is deterministic and mutation-free.
- [x] Classifier imports no command and makes no network call.
- [x] Every registry `continue` retains a button outcome.
- [x] Exact High quick gate passes; its TypeScript phase exceeded the five-minute soft budget and is not claimed within SLA.

## Plan

- [x] Re-anchor from current main and verify slice-3 dependency.
- [x] Implement the narrow classifier and pure resolver.
- [x] Add focused contract/fence tests and D-206.
- [x] Run focused tests and the authorized High quick gate.
- [x] Inspect the implementation diff.
- [x] Push and open the slice PR; stop before merge/deploy.

## Evidence log

- `git status --short --branch` was clean on `onboarding/4-actions` before the worksession was created.
- Final focused contract run -> **89/89 passed** across `test/onboarding-actions.test.ts` and `test/onboarding-affirmative.test.ts`; TypeScript and diff hygiene passed.
- Pre-cleanup High quick gate -> AI surface, TypeScript, diff hygiene, **112 fast + 7 serial tests passed** in **73.662s** with no five-minute breach; this was superseded by the exact implementation-head run below.
- Clean exact-implementation-head High quick gate at `4e7a716efae8856046ebc3edda25a1e34954c22a` -> AI surface, TypeScript, diff hygiene, **111 fast + 7 serial tests passed** in **632.273s**; the TypeScript phase took **543.493s**, so the five-minute soft budget was breached; fingerprint `f8dd0b27b4dd8d9508555090422b563ed33478c5d0e1c8b0346d064f6ceacd8b`.
- `pnpm build` -> **passed**; existing PGlite browser-external/eval and large-chunk warnings only.
- `pnpm ai:verify` -> **passed**; 48 required files and two Clerk fences.
- `pnpm check:windows` -> **unavailable on this macOS host** because `pwsh` is not installed. No Windows test failure was observed.
- `pnpm test:full` was not run; exhaustive proof requires Jonathan's explicit authorization for an exact clean High/Release-risk SHA.
- PR [#321](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/321) opened from `onboarding/4-actions` into `main`; exact PR-head CI follows after this worksession closure commit.

## Decisions

- Typed text may continue, pause, or reopen. It cannot approve, submit, edit, navigate, stop setup, or skip a personal module.
- The resolver describes intent only; existing commands retain mutation authority.

## Remaining uncertainty

- UI wiring and accepted probe execution belong to later slices.
- Exact-head CI remains pending after the worksession closure commit.

## Handoff

Codex owns implementation and proof. Stop after the exact slice-4 PR is open and verified; merge and Development publication require a later explicit instruction.
