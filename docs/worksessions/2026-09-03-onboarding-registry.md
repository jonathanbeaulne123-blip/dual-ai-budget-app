# Hearth worksession — onboarding chapter registry

- **Status:** COMPLETE
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/1-registry`
- **Baseline SHA:** `64740b34a714d0fcb325dd76a10bc4e056e669cd`
- **Head SHA:** implementation `fd28478bb0d39aa0ff884d3700afdfc5b6a28f43`; this documentation-only close follows
- **PR or issue:** [#317](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/317)
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

- [x] Shipped registry validates with no problems.
- [x] One malformed fixture proves every required problem code.
- [x] Household registry returns exactly twelve chapters in canonical order.
- [x] Registry source imports no command module and contains no TSX dependency.
- [x] Focused test and authorized quick gate pass without a time-budget breach.
- [x] Build and AI-surface verification pass.
- [x] Windows gate was attempted and its missing-host-tool limitation is recorded.

## Plan

- [x] Reverify branch point, dependency state, and current canon.
- [x] Implement types, registry, validator, exports, tests, and decision.
- [x] Run focused and repository gates.
- [x] Close the worksession, commit, push, and open the unmerged PR.

## Evidence log

- `git fetch origin main onboarding/0-verify`: `origin/main` remained `64740b3`; slice 0 commit `b60c7e3` was not an ancestor of main.
- `pnpm vitest run test/onboarding-registry.test.ts`: **16/16 passed**.
- `pnpm test -- --risk=medium --focus=test/onboarding-registry.test.ts --focus-reason="The registry suite exercises every required invariant and the exact twelve-row contract."`: **passed** 45 selected tests, TypeScript, AI-surface verification, and diff hygiene in **70.191s**; no five-minute breach.
- Exact PR-candidate rerun with the closed handoff present: **passed** the same 45 selected tests and gates in **113.094s**; no five-minute breach, change fingerprint `5bf85bc1`.
- `pnpm build`: **passed**; existing PGlite browser-external/eval and bundle-size warnings only.
- `pnpm ai:verify`: **passed**; 48 required files and two Clerk fences.
- `pnpm check:windows`: **unavailable on this macOS host** because `pwsh` is not installed. No Windows test failure was observed.
- `pnpm test:full`: not run; exhaustive proof was neither required nor authorized for this Medium slice.
- PR [#317](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/317) opened against `main`; unmerged, not deployed, and not live.

## Decisions

- The registry is pure metadata. It imports only onboarding types, while the types import the canonical `HearthTab` type.
- **D-203 proposed:** onboarding chapters are validated registry records, not code paths.

## Remaining uncertainty

- `docs/DECISIONS.md` already contains two D-202 assignments. This slice will not silently rewrite either historical record.
- GitHub CI and review remain pending. The local macOS host cannot supply the required PowerShell/Windows evidence.

## Handoff

Local implementation is committed at `fd28478`, pushed on `onboarding/1-registry`, and open in PR #317. It is not merged, deployed, or live. Jonathan is the next owner for review and the merge decision; onboarding slice 2 remains a separate request.
