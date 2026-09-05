# Hearth worksession — onboarding category selection

- **Status:** CLOSED; LOCAL IMPLEMENTATION AND PROOF COMPLETE
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/19-ch9-categories`
- **Baseline SHA:** `f5ef04722830b5661c4f312da6e5ca5b5f5f84b6`
- **Implementation SHA:** `0d21cc41b0d745c0cf20d126473cca44d16bedbc`
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

- [x] A private draft changes no Household data before Submit.
- [x] One current submission reads waiting-member and reveals no partner choice.
- [x] Submission order does not change the merged category-id union.
- [x] A suggestion is not a canonical category before the reviewed merge.
- [x] Same-name/different-id suggestions require an explicit joint-facing choice.
- [x] Both current submissions produce cited household evidence.
- [x] No rendered string compares, ranks, ratios, or counts the members' choices.
- [x] The Chapter 9 Plan experience works at phone and desktop widths with
      keyboard and reduced-motion checks.

## Plan

- [x] Verify current main, exact Slice 19 contract, and Slice 18 boundary.
- [x] Add the staged suggestion and reviewed merge contract.
- [x] Project Chapter 9 evidence and route Hercules to the existing Plan surface.
- [x] Build the private-select, wait, reveal, conflict, and merged UX states.
- [x] Run focused tests, Medium quick gate, build, auditors, and browser proof.
- [x] Close the worksession with exact evidence and remaining uncertainty.

## Evidence log

- Baseline `pnpm test` passed AI-surface verification and TypeScript with no
  selected tests before implementation.
- Focused and adjacent category/submission/evidence/copy/conductor/runtime
  proof passed 122/122 tests, including 13/13 Slice 19 contract and UI tests.
- Exact clean implementation SHA `0d21cc4` passed the Medium quick gate in
  25.4 seconds: 85 fast plus 7 serial PGlite proof tests, TypeScript,
  AI-surface, and diff hygiene; fingerprint
  `14f181feea41a815bad2aafb367730c764c76f898833bf6840c8d19480913081`.
  The five-minute budget was not breached and the gate correctly required
  separate UI proof.
- Production `pnpm build` passed TypeScript, Vite at 467 modules, and Hercules
  Pro UI. Only the existing PGlite browser-external/eval and large-chunk
  warnings appeared.
- `pnpm ai:verify` passed 48 required files and both Clerk fences.
- `pnpm check:windows` could not start because this macOS host has no `pwsh`;
  no Windows result is claimed.
- Actual-component browser proof covered draft, waiting, conflict review, and
  completed states at 320, 390, 720, and 1100 px. No width overflow occurred;
  actionable controls were at least 46 px; reduced motion removed transitions;
  keyboard Enter added an idea; Submit reached the private waiting state; and
  scoped axe scans at 320/720/1100 reported zero violations. The initial scan
  found one small-text contrast miss on the existing orange kicker treatment;
  the Chapter 9 card now uses the darker pine token and the rerun passed.
- Temporary browser harness files and the local Vite server were removed.

## Decisions

- D-219: a suggested category is Shared only with the explicit category
  submission and becomes canonical only through the reviewed merge command.

## Remaining uncertainty

- Hosted two-account delivery is release evidence and was not authorized here.
- The Windows lane remains unproved on this macOS host.

## Handoff

Local implementation and proof are complete at `0d21cc4`. Jonathan decides
whether to push or open a PR. Merge, deployment, hosted mutation, and Production
remain separate decisions.
