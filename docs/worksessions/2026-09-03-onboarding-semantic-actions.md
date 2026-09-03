# Hearth worksession — onboarding semantic actions

- **Status:** READY FOR PR
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/4-actions`
- **Baseline SHA:** `48514441731e7cf2c53b152fe6867b3cfaa39058`
- **Head SHA:** pending
- **PR or issue:** pending
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
- [ ] Exact High quick gate passes.

## Plan

- [x] Re-anchor from current main and verify slice-3 dependency.
- [x] Implement the narrow classifier and pure resolver.
- [x] Add focused contract/fence tests and D-206.
- [x] Run focused tests and the authorized High quick gate.
- [ ] Inspect the diff, push, open the slice PR, and stop before merge/deploy.

## Evidence log

- `git status --short --branch` was clean on `onboarding/4-actions` before the worksession was created.
- Final focused contract run -> **89/89 passed** across `test/onboarding-actions.test.ts` and `test/onboarding-affirmative.test.ts`; TypeScript and diff hygiene passed.
- Pre-cleanup High quick gate -> AI surface, TypeScript, diff hygiene, **112 fast + 7 serial tests passed** in **73.662s** with no five-minute breach. A final exact-diff quick gate follows after worksession closure.
- `pnpm build` -> **passed**; existing PGlite browser-external/eval and large-chunk warnings only.
- `pnpm ai:verify` -> **passed**; 48 required files and two Clerk fences.
- `pnpm check:windows` -> **unavailable on this macOS host** because `pwsh` is not installed. No Windows test failure was observed.
- `pnpm test:full` was not run; exhaustive proof requires Jonathan's explicit authorization for an exact clean High/Release-risk SHA.
- PR evidence pending.

## Decisions

- Typed text may continue, pause, or reopen. It cannot approve, submit, edit, navigate, stop setup, or skip a personal module.
- The resolver describes intent only; existing commands retain mutation authority.

## Remaining uncertainty

- UI wiring and accepted probe execution belong to later slices.
- Exact-head CI and automated review remain pending until the PR exists.

## Handoff

Codex owns implementation and proof. Stop after the exact slice-4 PR is open and verified; merge and Development publication require a later explicit instruction.
