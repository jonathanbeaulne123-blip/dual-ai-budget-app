# Hearth worksession — onboarding submission contract

- **Status:** CLOSED; LOCAL IMPLEMENTATION AND PROOF COMPLETE
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/18-submissions`
- **Baseline SHA:** `1d4998379875bde84229f194b85242b815218940`
- **Implementation SHA:** `f400132e388e2eceb8d7348275808659d8b43c16`
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; synthetic local Development fixtures only

## Household outcome

Each person can privately make a draft, then explicitly submit only their own
category choices or estimate cents into a calm, auditable household record.
Both devices converge without comparison, posting, or loss.

## Budget delta (5)

`+1` — durable, cited first-plan inputs become available without treating a
guess or selection as money, approval, or a contribution claim.

## Engagement delta (3)

`+1` — each person can contribute independently and see the combined category
shape later, without ranking or competitive framing.

## Verified baseline

- Fresh isolated worktree started from clean `origin/main@1d49983` after Slice
  17 merged as PR #338.
- The canonical working checkout had unrelated changes and was left untouched.
- Baseline `pnpm test` passed AI-surface verification and TypeScript with no
  selected test failures.
- The exact Slice 18 contract was recovered from the onboarding manual and
  reconciled with the newer `_1` master sequence: Slice 18 is submissions;
  categories are Slice 19.

## Scope

### In scope

- Typed category and estimate submission records.
- Self-attributed explicit Submit commands.
- Append-only replacement history and deterministic current selectors.
- Deterministic two-member category union; member-separated estimates.
- Shared-envelope, compacted command, and command-event continuity.
- Focused privacy, money, convergence, malformed-state, and source-fence tests.

### Out of scope

- Draft UI or storage, Chapter 9/10 UI, category creation/adoption, proposal
  math, approvals, budget adoption, transactions, journal rows, Fund events,
  schema, hosted rows, Auth/RLS, providers, secrets, Production, push, PR,
  merge, deployment, or hosted-live proof.

## Acceptance evidence

- [x] A missing or different actor cannot submit for another member.
- [x] An explicit submission serializes only category ids or estimate cents.
- [x] Replacement appends, increments revision, and retains linked history.
- [x] Two-device order does not change the merged rows or category union.
- [x] Estimates remain member-separated and zero remains distinct from missing.
- [x] Submission changes no compiled journal entry.
- [x] Wrong-member command-event materialization is refused.
- [x] High-risk quick gate, build, AI verifier, and Windows host gap recorded.
- [x] Independent High-risk trust review recorded.

## Plan

- [x] Verify current main, contract, branch, and existing continuation boundary.
- [x] Implement the pure record/merge contract and self-owned commands.
- [x] Wire the stated offline merge law through current Shared continuity.
- [x] Add focused command, privacy, journal, convergence, and event tests.
- [x] Run final gates and independent review; close the worksession.

## Evidence log

- Baseline `pnpm test`: passed, 0 selected tests, TypeScript and AI surface green.
- Focused and adjacent command/runtime/materialization suite: 53/53 passed,
  including 13/13 Slice 18 contract tests.
- High-risk quick gate with explicit Slice 18 focus: passed in 46.4 seconds,
  fingerprint `d1b2af345b28bc56999f5c6b0b4b6c52fc265d1298fc7f1cd45b21c0c6911de4`;
  67/67 fast tests and 7/7 serial PGlite proof tests passed, with no
  five-minute budget breach and `uiProofRequired: false`.
- Production `pnpm build`: passed TypeScript, Vite at 465 modules, and the
  Hercules Pro UI build; only the existing PGlite browser-external/eval and
  large-chunk warnings appeared.
- `pnpm ai:verify`: passed 48 required files and both Clerk fences.
- `pnpm check:windows`: unavailable because this macOS host has no `pwsh`; no
  Windows result is claimed.
- Independent High-risk trust review: PASS after adversarial actor, non-submit,
  bundled-money, duplicate-id, dangling-link, skipped-revision, compacted-event,
  and extra-field privacy repairs; no remaining local correctness or security
  blocker.
- No component or CSS file changed, so Slice 18 has no rendered surface and no
  browser viewport pass is applicable.
- Correctness-required scope expansion beyond the manual's Modify list:
  `sync.ts`, command identity/runtime, and command-event materialization carry
  the contract through the cloud-authoritative Shared path already on main.

## Changed files

- Submission contract and commands: `src/core/onboarding/submissions.ts`,
  `src/core/commands.ts`, `src/core/types.ts`, `src/core/index.ts`.
- Shared continuity and trust boundary: `src/core/sync.ts`,
  `src/core/commandIdentity.ts`, `src/core/commandRuntime.ts`,
  `src/ledger/continuityCommandLog.ts`,
  `src/ledger/materializeSnapshotFromEvents.ts`.
- Proof and canon: `test/onboarding-submissions.test.ts`, this worksession,
  the Slice 18 contract brief, `docs/AI_HANDOFF.md`, `docs/DECISIONS.md`, and
  `docs/HEARTH_ROADMAP.md`.

## Decisions

- D-218: an onboarding submission shares a choice, not a claim.

## Remaining uncertainty

- Hosted two-account delivery is release evidence and was not authorized here.
- Chapter 9 and Chapter 10 will own draft choreography and the rendered waiting
  states; this core slice intentionally adds no UI.

## Handoff

Local implementation and proof are complete. Jonathan decides whether to push
or open a PR. Merge, deploy, hosted mutation, and Production remain separate
decisions.
