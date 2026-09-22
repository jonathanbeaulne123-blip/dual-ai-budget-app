# Hearth worksession — World rebase onto current main

- **Status:** CONDITIONAL — final gate has one reproduced current-main Windows failure
- **Opened:** 2026-09-21 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/rebase-world-31764`
- **Baseline SHA:** `31764ee22810a1b409d1b362c9be97e66da3db7d`
- **Head SHA:** recorded in the verification evidence after the local cleanup commit
- **PR or issue:** none; supplied `claude/world@190a2859af05050750a154e23e75ca19417a70b7` bundle
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Bring the World-only interaction and presence work forward without changing financial commands, stale-write refusal, hosted data, or environments.

## Budget delta (5)

0 — preserve the existing command and scoped-write safety boundary exactly.

## Engagement delta (3)

+3 — a walkable Harbour world, optional live presence, and World navigation are made compatible with current main.

## Verified baseline

`origin/main@31764ee2` contains Wave 3 (#517) and scoped write identities (#518). The supplied World bundle is valid, is based on `1b5a2882`, and its Wave 3 tree exactly matches #517. A dry merge into current main conflicts in `src/App.tsx`, `src/harbour/HarbourWorld.tsx`, `src/harbour/court/CourtScene.ts`, and `src/harbour/scene/runtime.ts`.

## Scope

### In scope

- Rebase World-only commits onto `31764ee2`.
- Preserve #518's scoped-write protections in `src/App.tsx`.
- Deliberately reconcile the three Harbour conflicts.
- Remove trailing whitespace from the evidence patch.
- Run focused and full local verification on the exact rebased head.

### Out of scope

- Push, PR creation, merge, deployment, Production, migrations, secrets, or hosted-data mutation.
- Any new feature or functional change beyond the World reconciliation.

## Acceptance evidence

- [ ] Rebased history is rooted at `31764ee2`; Wave 3 is not duplicated.
- [ ] App scoped-write safeguards from #518 remain present.
- [ ] World runtime conflicts are resolved with both current-main and World behaviour retained.
- [ ] `git diff --check`, focused tests, and `pnpm check` are recorded against the rebased head.
- [ ] No private artifact, credential, or hosted mutation is introduced.

## Plan

- [x] Verify bundle, baseline, and merge conflicts in an isolated worktree.
- [ ] Replay World-only commits and resolve conflicts.
- [ ] Inspect final diff and run verification.
- [ ] Record results and residual uncertainty.

## Evidence log

- 2026-09-21: Bundle MD5 `df266cfdf876c9ab95804416637c9f35` matched its supplied reassembly instruction; `git bundle verify` and `git fsck` passed.
- 2026-09-21: No user workspace was modified; all work uses a disposable isolated worktree.
- 2026-09-21: Rebased only the 17 World commits after `claude/wave3@8d11615e` onto `origin/main@31764ee2`; Wave 3 was already present as #517. The rebase's internal World-space and World-presence conflict resolutions use their verified original merge results; `App.tsx` remains the current #518 version.
- 2026-09-21: Focused World suite passed: 8 files / 167 tests (`harbour-body`, world-space, presence/client+worker, wiring, wizard, and source fences). jsdom emitted its known no-canvas diagnostic while tests passed.
- 2026-09-21: Removed four trailing spaces from the checked-in World-space evidence patch; final full gate pending.
- 2026-09-21: Full `pnpm check` on the clean rebased head passed diff hygiene, AI-surface verification, TypeScript, and test discovery, then ran 88 fast test files / 817 tests. It stopped at `test/workspace-deployment.test.ts` because a POSIX expected image path is compared to Windows `path.join` output (`/review/...` versus `C:\\review\\...`). The same isolated test fails identically on clean `origin/main@31764ee2`; it is not a World regression.
- 2026-09-21: Additional build proof passed: workspace TypeScript, Vite production build, Hercules Pro UI build, and the no-`dist/_redirects` assertion. Vite emitted existing browser-externalization and chunk-size warnings only.

## Decisions

- Current `origin/main` is authoritative over the attachment handoff where their baselines differ.

## Remaining uncertainty

- The full local gate cannot be green on this Windows host until the current-main workspace deployment assertion is made platform-neutral. The rebased World-specific focused suite and production build are green.

## Handoff

Next owner: Jonathan for the baseline-test decision and any later review, push, or merge decision. The current state is local-only and unpushed; no Production, hosted data, schema, secret, or deployment action occurred.
