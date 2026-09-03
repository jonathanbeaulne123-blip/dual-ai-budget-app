# Hearth worksession — onboarding chapter registry

- **Status:** OPEN
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/1-registry`
- **Baseline SHA:** `64740b34a714d0fcb325dd76a10bc4e056e669cd`
- **Head SHA:** local working tree
- **PR or issue:** pending
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Every onboarding chapter has one deterministic, versioned record that later slices can inspect without creating a second workflow or money path.

## Budget delta (5)

`+1` assurance: typed registry invariants prevent personal modules from entering the household final gate and keep navigation, approvals, ordering, timing, and dependencies internally consistent. No financial behavior changes.

## Engagement delta (3)

`0`: this foundation intentionally renders nothing. Dual Course still holds because later Hercules choreography gets one validated source of truth without weakening the books.

## Verified baseline

- Fact: clean worktree created outside OneDrive from `origin/main@64740b34a714d0fcb325dd76a10bc4e056e669cd`.
- Fact: onboarding slice 0 is complete on PR #316 but is not merged and is not being treated as `main`.
- Fact: `src/core/onboarding/` does not exist at the branch point.
- Fact: `HearthTab` has seven current values in `src/core/hercules.ts`.
- Inference: sequential chapter dependencies and three deterministic flavor keys per row are the smallest metadata choices consistent with the approved manual; they add no runtime behavior.

## Scope

### In scope

- Add onboarding registry types and twelve household chapter records.
- Validate every problem code named by onboarding slice 1.
- Add focused registry and source-fence tests.
- Re-export the new modules from `src/core/index.ts`.
- Record the registry architecture decision using the next free number at write time.

### Out of scope

- Probes, projectors, commands, household state, continuity, components, CSS, copy rendering, model calls, deployment, and Production.
- Repairing the pre-existing duplicate D-202 label.

## Acceptance evidence

- [ ] Shipped registry validates with no problems.
- [ ] One malformed fixture proves every required problem code.
- [ ] Household registry returns exactly twelve chapters in canonical order.
- [ ] Registry source imports no command module and contains no TSX dependency.
- [ ] Focused test and authorized quick gate pass without a time-budget breach.
- [ ] Build and AI-surface verification pass.
- [ ] Windows gate is run where available or its host limitation is recorded.

## Plan

- [x] Reverify branch point, dependency state, and current canon.
- [ ] Implement types, registry, validator, exports, tests, and decision.
- [ ] Run focused and repository gates.
- [ ] Close the worksession, commit, push, and open the unmerged PR.

## Evidence log

- `git fetch origin main onboarding/0-verify`: `origin/main` remained `64740b3`; slice 0 commit `b60c7e3` was not an ancestor of main.

## Decisions

- The registry is pure metadata. It imports only onboarding types, while the types import the canonical `HearthTab` type.

## Remaining uncertainty

- `docs/DECISIONS.md` already contains two D-202 assignments. This slice will not silently rewrite either historical record.

## Handoff

Pending implementation and verification. Jonathan remains the merge and release owner.
