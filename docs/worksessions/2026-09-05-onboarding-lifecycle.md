# Hearth worksession — onboarding lifecycle

- **Status:** RELEASE CANDIDATE; LOCAL TESTS + BUILD + UX VERIFIED
- **Opened:** 2026-09-05 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/27-lifecycle`
- **Baseline SHA:** `e85599c135523034526661e0d381ebaa005fb7ee`
- **Head SHA:** `819b2ec89f665a5d4c6c88e5c923ae7635798078` (rebased implementation; this documentation update follows)
- **PR or issue:** pending creation; Jonathan authorized push, merge, and Development deployment
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development metadata only; Production behavior remains inactive on environment mismatch

## Household outcome

Completed households stay open for ordinary use. Replacement members receive a short private catch-up without relocking anyone. Stopped runs revalidate live and canonical evidence, registry drift enters repair, and demo households arrive ready to explore.

## Budget delta (5)

`+2` — completion, environment, evidence invalidation, registry repair, and synthetic approval facts are explicit and convergent without changing accounting math.

## Engagement delta (3)

`+2` — a new member sees three relevant chapters with a soft exit, while existing members and demo users avoid repeated setup.

## Verified baseline

- `origin/main@e85599c135523034526661e0d381ebaa005fb7ee` includes merged Slice 26 plus the realtime-session lease repair.
- Shared completion already unlocked ordinary Hercules, but new-member catch-up, resume invalidation, and demo completion did not exist.
- Member onboarding progress is Personal; shared completion and Ready approvals are Shared.

## Scope

### In scope

- Sticky completion and merge convergence.
- Member-only Ch. 1, 2, and 8 catch-up.
- Environment isolation and registry migration planning.
- Current-state resume re-probing with monotonic stale-evidence invalidation.
- Deterministic demo completion and narrow Demo Suite acceptance.
- Focused tests, aggregate onboarding tests, heavy demo replay, build, and browser UX proof.

### Out of scope

- Money commands, journals, budgets, schema, hosted data operations, Auth/RLS changes, providers/models, secrets, or Production activation.

## Acceptance evidence

- [x] Charter amendment and stale stopped replicas do not reopen completion.
- [x] A replacement member advances Ch. 1 → Ch. 2 → Ch. 8 while existing members remain unlocked.
- [x] Production does not accept Development completion.
- [x] Seeded demos have a synthetic digest, two Ready approvals, no gates, and no invitation.
- [x] Resume demotes live Ch. 2 and stale canonical facts; invalidation survives replica merge.
- [x] Registry mismatch repairs and unknown chapter ids fail closed.
- [x] Actual-component browser proof at 320/390/720/1100 px has no overflow, undersized controls, console/page errors, or scoped axe WCAG A/AA finding.

## Evidence log

- Focused lifecycle/mode/progress/scope/demo: 46/46 passed.
- Aggregate onboarding plus demo seed: 463/463 passed.
- Demo Suite isolated matrix: 8/8 passed, including deterministic replay, tamper detection, all Hercules calculation surfaces, privacy, environment, merge, profiles, and Toronto DST.
- TypeScript: passed.
- Browser: Chromium, reduced motion, 320/390/720/1100 px; `Next` is 48 px high and `Not now` is at least 44 px in both dimensions; no horizontal overflow.
- Clean High-risk quick gate passed in 21.5 seconds before the current-main rebase: diff hygiene, AI surface, TypeScript, 57 fast tests, and 7 serial PGlite proof tests. The same gate is rerun at the final rebased head.
- Production build passed at the rebased head with 480 Vite modules plus Hercules Pro UI. Existing PGlite browser-externalization/eval and large-chunk messages remain warnings.
- Release review found and repaired a convergence edge case where an older replica could hide a successful post-invalidation re-probe. The regression now proves that the newer valid proof survives merge.

## Decisions

- D-227 records lifecycle precedence, new-member scope, monotonic invalidation, and the narrow synthetic demo exception.

## Remaining uncertainty

- This is local synthetic proof, not hosted two-account, Windows, or Production proof. Deployment evidence is recorded separately by the release run.
- The structured release review is complete; no P0-P2 finding remains. An independent human or separate-agent review was unavailable in this session.

## Handoff

Jonathan authorized push, merge, and the Development Worker deployment on 2026-09-05. The release run must wait for required checks and smoke the exact merged deployment.
