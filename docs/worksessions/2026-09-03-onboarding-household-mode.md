# Hearth worksession — onboarding household mode

- **Status:** COMPLETE
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/2-household-mode`
- **Baseline SHA:** `27b1c0345fcb3fa28e76883dc575166fdc298cde`
- **Head SHA:** implementation `c2f2bb57b3fca50c47c32a342b6009a255d8e8c9`; this documentation-only close follows
- **PR or issue:** [#318](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/318)
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

- [x] One test per slice-2 rule, including enumeration of every onboarding mode command.
- [x] Two offline device confirmations merge to `active` exactly once.
- [x] `mode.ts` imports no TSX, component, provider, or money writer.
- [x] The exact clean High quick gate passes with no new failing set.
- [x] `pnpm build` passes.
- [x] `pnpm ai:verify` passes.
- [x] `pnpm check:windows` was attempted and the exact local limitation is recorded.
- [x] PR is open and unmerged at the exact implementation head.

## Plan

- [x] Implement and export the pure mode model, defensive shaper, and deterministic merge.
- [x] Add the shared Household/SharedEnvelope field and wire sync shaping, split, assembly, and merge.
- [x] Add command-boundary transitions with exact consent and stop invariants.
- [x] Bind mode changes to command identity and guarded ordered continuity replay.
- [x] Add focused tests and the next free decision record.
- [x] Run focused and repository gates, review the exact diff, push, and open the slice PR.

## Evidence log

- `git fetch origin --prune`; `git rev-parse origin/main` -> `7a5c730f237fbd0c5e5fa2487839b9df3c4718eb`.
- `git status --short --branch` -> clean `onboarding/2-household-mode...origin/main` before worksession creation.
- `git fetch origin --prune`; `origin/main` advanced to `27b1c0345fcb3fa28e76883dc575166fdc298cde`; the uncommitted slice was stashed, rebased, and restored without conflict.
- Focused test, pre-rebase: `pnpm vitest run test/onboarding-mode.test.ts` -> 14 passed after correcting one cross-household fixture.
- Production build, pre-rebase: `pnpm build` -> passed; existing PGlite externalization/eval and large-chunk warnings remained warnings.
- Final focused proof: `pnpm vitest run test/onboarding-mode.test.ts` -> **16/16 passed**, including exact command identity and ordered continuity replay.
- Exact clean implementation gate at `c2f2bb57b3fca50c47c32a342b6009a255d8e8c9`: `pnpm test -- --risk=high --focus=test/onboarding-mode.test.ts ...` -> **59 fast + 7 serial tests passed**, TypeScript, AI-surface verification, and diff hygiene in **132.195s**; no five-minute breach; fingerprint `9c78fb9d552823a1189238ccf397b6494ec6c00c63be8e7ec50667422e0acdb4`.
- `pnpm build` at the clean implementation head -> **passed**; existing PGlite browser-external/eval and large-chunk warnings only.
- `pnpm ai:verify` -> **passed**; 48 required files and two Clerk fences.
- `pnpm check:windows` -> **unavailable on this macOS host** because `pwsh` is not installed. No Windows test failure was observed.
- `pnpm test:full` was not run; exhaustive proof requires Jonathan's explicit authorization for the exact clean SHA.
- Changed files: `docs/DECISIONS.md`; this worksession; `src/core/onboarding/mode.ts`; `src/core/types.ts`; `src/core/commands.ts`; `src/core/index.ts`; `src/core/sync.ts`; `src/core/commandIdentity.ts`; `src/core/commandRuntime.ts`; `src/ledger/materializeSnapshotFromEvents.ts`; `test/onboarding-mode.test.ts`.
- PR [#318](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/318) opened against `main` at exact implementation head `c2f2bb57b3fca50c47c32a342b6009a255d8e8c9`; unmerged and undeployed.

## Decisions

- Use the accepted shared onboarding record as the only authority for setup mode and ordinary Hercules availability.
- Keep offer and pending-handshake states in free roam; only a record containing every active member confirmation may become active.
- D-204 records the co-present entry and honest-stop boundary on the current decision log.

## Remaining uncertainty

- The manual requires independent trust review before this High-risk slice is accepted; that review and GitHub CI are pending on PR #318.
- The macOS host cannot supply native PowerShell/Windows evidence.

## Handoff

Local implementation is committed at `c2f2bb5`, pushed on `onboarding/2-household-mode`, and open in PR #318. It is not merged, deployed, or live. An independent trust reviewer is the next technical owner; Jonathan remains the decision owner for merge or deployment. No UI was built, so no manual live verification applies.
