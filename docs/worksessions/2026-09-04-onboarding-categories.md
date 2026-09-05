# Hearth worksession — onboarding category selection

- **Status:** OPEN
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/19-ch9-categories`
- **Baseline SHA:** `f5ef04722830b5661c4f312da6e5ca5b5f5f84b6`
- **Head SHA:** `f5ef04722830b5661c4f312da6e5ca5b5f5f84b6`
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none; synthetic local Development fixtures only

## Household outcome

Each person privately chooses what the household budget should cover. One
submitted list waits without revealing the other person's choices. After both
submit, Hearth reveals one calm combined set; suggested categories become real
only through a reviewed merge action.

## Budget delta (5)

`+1` — the household agrees on the categories that will receive first-plan
estimates without turning a selection into a budget or money movement.

## Engagement delta (3)

`+2` — both people contribute independently, then see a shared result without
scores, ratios, rankings, or competitive framing.

## Verified baseline

- Fresh isolated worktree starts from clean `origin/main@f5ef0472`, after Slice
  18 merged as PR #339.
- The newer `_1` master sequence assigns Slice 19 to Chapter 9 on branch
  `onboarding/19-ch9-categories`; the detailed manual requires private
  selection, a waiting-member state, deterministic union, and reviewed
  category adoption.
- Slice 18 already supplies append-only self-owned category submissions and
  deterministic category-id union, but deliberately excludes draft UI and
  category creation/adoption.

## Scope

### In scope

- A private local category-selection draft on the existing Plan surface.
- Explicit self-owned Submit and a non-revealing waiting state.
- Staged Shared category suggestions tied to the submitting member and
  submission revision.
- A reviewed merge command that creates canonical categories once, with
  explicit resolution of same-name/different-id conflicts.
- Household evidence after both current submissions, without comparison or
  selection counts.
- Shared/offline continuity for the staged suggestion and reviewed merge facts.
- Focused core, command, privacy, rendering, and UX/accessibility proof.

### Out of scope

- Estimate amounts, proposal math, plan approval/adoption, money commands,
  transactions, journal rows, Fund events, schema, hosted rows, Auth/RLS,
  providers, secrets, Production, push, PR, merge, or deployment.

## Acceptance evidence

- [ ] A private draft changes no Household data before Submit.
- [ ] One current submission reads waiting-member and reveals no partner choice.
- [ ] Submission order does not change the merged category-id union.
- [ ] A suggestion is not a canonical category before the reviewed merge.
- [ ] Same-name/different-id suggestions require an explicit joint-facing choice.
- [ ] Both current submissions produce cited household evidence.
- [ ] No rendered string compares, ranks, ratios, or counts the members' choices.
- [ ] The Chapter 9 Plan experience works at phone and desktop widths with
      keyboard and reduced-motion checks.

## Plan

- [x] Verify current main, exact Slice 19 contract, and Slice 18 boundary.
- [ ] Add the staged suggestion and reviewed merge contract.
- [ ] Project Chapter 9 evidence and route Hercules to the existing Plan surface.
- [ ] Build the private-select, wait, reveal, conflict, and merged UX states.
- [ ] Run focused tests, Medium quick gate, build, auditors, and browser proof.
- [ ] Close the worksession with exact evidence and remaining uncertainty.

## Evidence log

Evidence will be recorded from this branch only.

## Decisions

- Pending: a suggested category is Shared only with the explicit category
  submission and becomes canonical only through the reviewed merge command.

## Remaining uncertainty

- Hosted two-account delivery is release evidence and is not authorized here.

## Handoff

Local implementation is in progress. Jonathan remains the release decision
owner; push, PR, merge, deployment, and hosted mutation remain separate.
