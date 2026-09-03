# Hearth worksession — onboarding household mode

- **Status:** OPEN
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/2-household-mode`
- **Baseline SHA:** `27b1c0345fcb3fa28e76883dc575166fdc298cde`
- **Head SHA:** uncommitted working tree over `27b1c0345fcb3fa28e76883dc575166fdc298cde`
- **PR or issue:** not opened
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none until merged and deployed

## Household outcome

The household remains in free roam until two active members consent on their own devices inside one bounded handshake window. Stopping setup restores ordinary Hercules without creating a false completion record.

## Budget delta (5)

`+2` assurance: the slice adds shared consent, defensive shaping, and deterministic offline convergence without changing any amount, journal row, projection, or Confirm boundary.

## Engagement delta (3)

`+2`: the quiet offer and co-present consent ritual make household setup collaborative while keeping ordinary Hercules available until both people agree.

## Verified baseline

- The branch began at `7a5c730f237fbd0c5e5fa2487839b9df3c4718eb`, the merge of onboarding slice 1, then rebased before decision-number claim when `origin/main` advanced.
- Current `origin/main` and branch baseline are `27b1c0345fcb3fa28e76883dc575166fdc298cde` (`feat(fund): the shape of the month`).
- The worktree was clean before this worksession was created.
- `Household` and `SharedEnvelope` do not yet carry an onboarding record.
- `splitForSync`, `assembleHousehold`, and `mergeShared` enumerate shared fields, so continuity requires explicit onboarding integration.
- Inference to prove: a deterministic merge can union separate member confirmations without allowing a one-member activation.

## Scope

### In scope

- A defensive, version-aware `HouseholdOnboarding` shape and state predicates.
- Offer, propose, confirm, stop, and resume commands through the existing clone-and-commit boundary.
- Shared-envelope shaping, split, assembly, and deterministic merge for two-device continuity.
- Exact slice-2 copy constants, focused tests, source fences, and a new decision entry.

### Out of scope

- UI, `src/App.tsx`, chapter progress, copy-deck infrastructure, model/provider calls, money behavior, schemas, Production data, merge, and deployment.

## Acceptance evidence

- [ ] One test per slice-2 rule, including enumeration of every onboarding mode command.
- [ ] Two offline device confirmations merge to `active` exactly once.
- [ ] `mode.ts` imports no TSX, component, provider, or money writer.
- [ ] `pnpm test` passes with no new failing set.
- [ ] `pnpm build` passes.
- [ ] `pnpm ai:verify` passes.
- [ ] `pnpm check:windows` passes or the exact local limitation is recorded.
- [ ] PR is open and unmerged at the exact reviewed head.

## Plan

- [ ] Implement and export the pure mode model, defensive shaper, and deterministic merge.
- [ ] Add the shared Household/SharedEnvelope field and wire sync shaping, split, assembly, and merge.
- [ ] Add command-boundary transitions with exact consent and stop invariants.
- [ ] Add focused tests and the next free decision record.
- [ ] Run focused and repository gates, review the exact diff, push, and open the slice PR.

## Evidence log

- `git fetch origin --prune`; `git rev-parse origin/main` -> `7a5c730f237fbd0c5e5fa2487839b9df3c4718eb`.
- `git status --short --branch` -> clean `onboarding/2-household-mode...origin/main` before worksession creation.
- `git fetch origin --prune`; `origin/main` advanced to `27b1c0345fcb3fa28e76883dc575166fdc298cde`; the uncommitted slice was stashed, rebased, and restored without conflict.
- Focused test, pre-rebase: `pnpm vitest run test/onboarding-mode.test.ts` -> 14 passed after correcting one cross-household fixture.
- Production build, pre-rebase: `pnpm build` -> passed; existing PGlite externalization/eval and large-chunk warnings remained warnings.

## Decisions

- Use the accepted shared onboarding record as the only authority for setup mode and ordinary Hercules availability.
- Keep offer and pending-handshake states in free roam; only a record containing every active member confirmation may become active.
- D-204 records the co-present entry and honest-stop boundary on the current decision log.

## Remaining uncertainty

- Exact merge and resume edge cases remain to be proven by the focused command and continuity suite.

## Handoff

Codex owns implementation and PR creation. Jonathan remains the decision owner and next owner for merge or deployment. Current state: local branch only; no PR, merge, deployment, or manual live verification.
