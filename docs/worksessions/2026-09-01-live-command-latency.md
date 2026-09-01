# Hearth worksession — Live command latency recovery

- **Status:** CLOSED — LOCAL IMPLEMENTATION VERIFIED; RELEASE NOT STARTED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/sync-live-latency-fix`
- **Baseline SHA:** `f9958758547e8d2c99733a2f0f44294c003346d5`
- **Head SHA:** uncommitted verified local worktree over the exact baseline
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development command-Realtime receiver only; Production continuity remains off

## Household outcome

A confirmed shared command received on the partner device crosses one serialized PGlite acceptance before display. Snapshot notifications from the same cloud transaction wait briefly for their command event, then read the already-committed command log before any full snapshot replay. They become full recovery only when that exact revision cannot be safely reached from visible valid command rows.

## Budget delta (5)

`+4` — removes competing PGlite accepts without weakening command hash, revision, scope, journal, or snapshot-recovery checks.

## Engagement delta (3)

`+1` — live partner updates should feel immediate again instead of routinely taking multiple seconds. No visual or Hercules work is added.

## Verified baseline

- Exact clean baseline was `main@f9958758547e8d2c99733a2f0f44294c003346d5`.
- The supplied Development diagnostic reported Realtime `SUBSCRIBED`, 15 command events, 47 snapshot signals, 8 snapshot accepts, and 4 command accepts. Same-device `realtime-received` to `remote-accepted` samples were about 7–15 seconds, so phone/desktop clock skew cannot explain the receiver delay.
- `onSnapshotSignal` started a full coordinated replay immediately while `onCommandEvent` ran outside that coordinator. Both paths could enter PGlite concurrently.
- A successfully applied hosted command retained its old `baseRevision`, causing its matching snapshot to look newer and invite another recovery acceptance.

## Scope

### In scope

- Put command-event acceptance on the existing continuity coordinator.
- Coalesce snapshot echoes and give the matching command row a bounded grace period.
- On expiry, catch up from the committed command log before permitting a full snapshot replay to occupy PGlite.
- Mark a locally accepted hosted command as synchronized to its exact result revision.
- Preserve immediate snapshot recovery for missing, unknown, hidden, invalid, conflicted, or revision-gap command events.
- Add deterministic concurrency, coalescing, revision, and recovery regressions.

### Out of scope

- Hosted schema, Supabase rows, credentials, secrets, Production continuity, cloud retention, accounting formulas, UI restyling, or financial commands.
- Push, merge, deploy, or live household mutation.
- Claiming the `<=500 ms p95` exit gate before a fresh deployed 100-sample two-account run.

## Acceptance evidence

- [x] Snapshot echoes are delayed and coalesced instead of immediately entering PGlite.
- [x] A matching accepted command cancels its redundant snapshot recovery.
- [x] Command and snapshot accept work use one coordinator lane.
- [x] Invalid/gap/unknown/conflicted paths retain snapshot recovery.
- [x] A delayed websocket command is read from the committed command log before full recovery starts.
- [x] A command accepted from the hosted log records the result revision as synchronized.
- [x] Focused continuity tests pass.
- [x] Full `pnpm check` passes on the final code tree.
- [x] Independent books/trust and continuity verification report no blocking finding.

## Plan

- [x] Trace the diagnostic to receiver-side PGlite contention and stale base revision.
- [x] Implement the bounded command/snapshot orchestration repair.
- [x] Add focused regressions.
- [x] Complete full verification and independent audit.
- [x] Hand off local status; release remains separately gated.

## Evidence log

- Final focused continuity gate: 4 files, 38 tests passed, 0 failed (`continuity-realtime-recovery`, `continuity-realtime`, `continuity-coordinator`, `continuity-command-realtime`); TypeScript passed.
- Exact final-code `pnpm check`: AI surface passed; 219 test files passed, 2 skipped; 1,503 tests passed, 3 skipped, 0 failed; TypeScript, Vite production build, Hercules Pro UI build, and `_redirects` refusal passed. Existing React `act`, PGlite browser-external/eval, and large-chunk warnings remained non-failing.
- Independent books/trust review: PASS after the recovery loop was tightened to stop exactly at the signalled revision. PGlite, authenticated RLS, Personal visibility, and fail-closed snapshot recovery remained intact.
- Independent latency verification: PASS after command-log-first recovery removed the delayed-websocket queue assumption. Fresh deployed two-account timing remains explicitly unproved.

## Decisions

- Command-event receipt remains the normal D-180 path. Snapshot notifications are triggers for recovery and never become display authority themselves.
- The grace is 300 ms. If the command websocket notification is later, the snapshot signal first fetches command rows newer than the local revision; the atomic cloud transaction guarantees those rows are committed before its snapshot notification. Only an absent, unusable, unknown, or conflicted catch-up enters full recovery.
- The command candidate is marked synchronized before `acceptHouseholdWrite`; it is not adopted unless PGlite and the ordinary acceptance boundary succeed.

## Remaining uncertainty

- The diagnostic strongly proves receiver-side queue/contention latency, but only a deployed two-account run can measure the repaired end-to-end p95.
- Full snapshot recovery remains intentionally slower and is not part of the normal command-event latency claim.

## Handoff

Local implementation and exact-code verification are complete. No commit, push, PR, merge, deployment, hosted mutation, or live-client proof occurred. Next owner is Jonathan for a separate release decision; after deployment, rerun the signed-in two-account 100-sample latency matrix before claiming `<=500 ms p95`.
