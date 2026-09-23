# Hearth worksession — Little Harbour walk feel and moves

- Status: CLOSED — integrated locally; remote merge is authorized, with no deployment
- Opened and closed: 2026-09-22 (America/Toronto)
- Owner and decision owner: Jonathan
- Integration owner: Codex
- Branch: review-walk-feel-moves
- Baseline: 577198e65eddfb573f0b559b3eca91972d137b6c (fresh `origin/main`)
- Integrated bundle tree: 3bb946e579b2f91cf03310bfadfe5c6db9e52d75
- Bundle order: `hearth-walk-feel.bundle` (`dc3168f54d6752144db80f9900943a0137afba20`), then `hearth-walk-moves.bundle` (`d8c262800b87e0765719190f16220363a973e864`)
- PR or issue: none; direct main integration requested by Jonathan
- Risk: Medium — Harbour movement, interaction, and bounded ephemeral presence; no money authority change
- Environment impact: source only; no Development or Production deployment

## Household outcome

Walking around Little Harbour has weight, dust and a following camera. A person can jump, slide, or choose one of six small emotes; the existing bounded world-presence channel lets a partner see only that moment. All existing financial doors and Confirm boundaries remain unchanged.

## Budget delta (5)

`0`. No balance, Fund, recurrence, transaction, command, ledger, or confirmation logic changes.

## Engagement delta (3)

`+3`. Walking receives clear physical feedback and optional shared play without becoming a money action.

## Verified baseline

- The user checkout was left untouched; integration happened in this clean temporary clone.
- `git merge --no-commit --no-ff bundle/walk-moves` applied cleanly onto fresh `origin/main`, including automatic merges in `src/harbour/HarbourWorld.tsx` and `src/harbour/scene/runtime.ts`.
- `git diff --cached --check` passed.
- The presence wire accepts only the closed act set `jump`, `slide`, `wave`, `dance`, `sit`, `cheer`, `laugh`, and `point`; phase is clamped to `0..1`. The Worker reconstructs those bounded display fields and carries no money or credential field.

## Scope

### In scope

Ordered bundle integration, movement/animation/presence review, bounded local tests, build, and local browser validation of the Harbour court.

### Out of scope

Financial logic, PGlite books, Auth/RLS, schema, secrets, hosted data, deployment, Production, and exhaustive verification.

## Acceptance evidence

- [x] Clean ordered integration and whitespace check.
- [x] Closed world-presence payload review.
- [x] Focused Harbour and presence test pass except the reproduced baseline assertion below.
- [x] Production build completed with both Harbour feature flags enabled; no `dist/_redirects` artifact remained.
- [x] Local browser validation in the fictional Demo household: 320, 390, 720, 1100, 1440, and 1920 px all rendered the Court canvas without horizontal overflow. J/K/E and an emote button completed without console errors; keyboard focus was visible; reduced-motion controls are covered by existing Harbour CSS and tests.

## Evidence log

- `pnpm test -- test/harbour-body.test.ts test/harbour-walk-everywhere.test.ts test/world-presence.test.ts test/world-presence-worker.test.ts --maxWorkers=1`: 193 passed, 1 failed. The sole failure was `harbour-walk-everywhere`'s stale twin-count expectation (`3` is not greater than `3`).
- The identical focused failure reproduced against unmodified `origin/main`: 76 passed, 1 failed. It is recorded as a pre-existing baseline exception, not waived as a candidate pass.
- `pnpm check` completed its TypeScript phase. Its fast test phase had 839 passed / 841 and exactly two failures: that same twin-count assertion and `workspace-deployment.test.ts` expecting a POSIX Dockerfile path while Windows emits `C:\\review\\workers\\workspace\\Dockerfile`. The workspace assertion also reproduced at unmodified `origin/main`.
- `VITE_HEARTH_HARBOUR=1 VITE_HEARTH_HOUSE_WORLD=1 pnpm build` completed successfully after adding the repository's Git shell utilities to the Windows command path. Vite reported existing advisory large-chunk warnings only.

## Decisions

Jonathan's 2026-09-22 instruction, “do that,” authorized this direct integration after the conditional review. The two pre-existing Windows/current-main test failures remain visible in the handoff and do not establish a new passing baseline. No deployment is authorized by this worksession.

## Remaining uncertainty

The broad `pnpm check` gate is conditional because its two failing assertions are pre-existing. Physical-device and signed-in two-member presence acceptance were not run; the local browser used only the fictional Demo household.

## Handoff

Codex will fast-forward the reviewed merge to `origin/main` only if the remote baseline remains `577198e65eddfb573f0b559b3eca91972d137b6c` at push time. Deployment, CI observation, and any live household acceptance are separate follow-up work.
