# Hearth worksession — Realtime self-healing continuity

- **Status:** COMPLETE — local release candidate; release and live proof pending
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/realtime-self-heal`
- **Original baseline SHA:** `8def9bd9ec70fe9c343f5b63880d0c6db2dcffd8` (`origin/main` when work opened)
- **Final rebased base SHA:** `8ae8071f16b945fe2a174a4df52e62054e1b63f3` (`origin/main`; documentation-only advance from the fully tested code base)
- **Verified application SHA:** `f3ca474` (committed locally; not pushed)
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

When a visible signed-in Hearth tab loses its Supabase Realtime socket, it restores the live command path automatically and catches up accepted commands immediately. The slower snapshot poll remains a fail-safe, not the ordinary route.

## Budget delta (5)

`+4` — partner-visible accepted money recovers from a closed WebSocket without waiting on minute-scale fallback polling, while every received command and recovery snapshot still crosses the existing PGlite/accounting acceptance boundary.

## Engagement delta (3)

`+1` — the household freshness row returns to honest **Live** state automatically instead of leaving an open kitchen on a degraded checker.

## Verified baseline

- Work opened from exact clean `origin/main@8def9bd9ec70fe9c343f5b63880d0c6db2dcffd8`; after concurrent Charter and Fund releases, the application passed its final full gate as `d477c27` over code base `86da91c`, then rebased without application conflict onto documentation-only `origin/main@8ae8071f16b945fe2a174a4df52e62054e1b63f3` as `f3ca474`.
- The 2026-09-01 privacy-safe receiving-device diagnostic ended at revision 66 with `realtimeStatus: CLOSED`, `freshnessMode: poll`, zero command-Realtime receipts, 27 poll fallbacks, and four snapshot accepts.
- A local accepted command reached hosted acknowledgement in 880 ms.
- Three recent fallback snapshot accepts took 4,497–4,972 ms after their poll was scheduled.
- Poll backoff grew from approximately 4 s to 8 s, 16 s, 33 s, then about 60 s while the tab remained open.
- Current `attachContinuityRealtime` creates a client and subscribes once. It does not configure worker heartbeats or explicitly heal terminal channel states.
- Supabase currently recommends worker-backed heartbeats plus explicit reconnect handling for browser tabs subject to background throttling.

## Scope

### In scope

- Development Realtime connection health and self-healing.
- Worker-backed heartbeat configuration where supported by the current pinned client.
- Bounded, deduplicated reconnect after terminal channel status or failed heartbeat.
- Immediate command-log/snapshot catch-up when the channel becomes subscribed again.
- Focus, visibility, and online recovery integration.
- Privacy-safe status/diagnostic evidence and focused regression tests.
- Canon and handoff updates for the changed behavior.

### Out of scope

- Production continuity or Realtime.
- Hosted schema, migrations, RLS, provider settings, secrets, or hosted row mutation.
- Reducing PGlite/accounting acceptance or displaying unaccepted remote money.
- Replacing the snapshot fallback or changing financial command semantics.
- Claiming the `<=500 ms p95` gate without a fresh deployed two-device 100-sample run.
- Push, merge, or deployment without a separate action-time request.

## Acceptance evidence

- [x] A silent/terminal Realtime failure schedules one bounded reconnect, not parallel clients.
- [x] A channel that attaches but does not acknowledge `SUBSCRIBED` within 5 seconds retries through bounded backoff.
- [x] A successful resubscription immediately schedules command-log-first catch-up and clears poll backoff.
- [x] Focus/visibility/online recover a closed connection without bypassing Auth or membership.
- [x] Cleanup cancels reconnect and subscription-ack work and removes the active channel.
- [x] Command and snapshot candidates retain the existing coordinator and PGlite acceptance path.
- [x] An unhealthy poll checks committed command rows before any snapshot replay.
- [x] Disabled, Auth-off, and Production Realtime do not start the healer.
- [x] Healthy `SUBSCRIBED` connections do not poll.
- [x] Focused tests, TypeScript, full tests, production build equivalent, diff check, and independent review pass.
- [x] Environment/data disclosure confirms Development-only code with no schema, secret, hosted row, or Production mutation.

## Plan

- [x] Add a small deterministic reconnect controller with timer/disposal tests.
- [x] Extend the Realtime adapter for heartbeat visibility and worker heartbeats.
- [x] Integrate terminal-status, heartbeat, focus, visibility, and online recovery in the App continuity effect.
- [x] Trigger immediate coordinator catch-up after resubscription.
- [x] Run focused and full verification, then independent trust and latency review.

## Evidence log

- Baseline status: clean branch `codex/realtime-self-heal` tracking `origin/main`.
- Diagnostic generated at `2026-09-01T07:21:07Z`; hashed identifiers only, no ledger facts or credentials.
- Supabase references: Realtime silent-disconnection, heartbeat, and monitoring documentation read on 2026-09-01.
- Focused exact-tree sync gate: 8 files / 85 tests passed; `tsc --noEmit` and `git diff --check` passed.
- Full exact final-rebased application tests: 224 files passed / 2 skipped; 1,549 tests passed / 3 skipped.
- `pnpm ai:verify`: 41 required files passed.
- The repository's `pnpm check` test and AI phases passed, but its Unix `rm` build wrapper cannot run under the Windows command shell. The exact equivalent stages passed separately on the final-rebased application commit: TypeScript, Vite production build (396 modules), Hercules Pro UI build, and explicit absence of `dist/_redirects`.
- Independent books/trust re-audit: **PASS** on fully tested application `d477c27` over `86da91c`; final `f3ca474` adds only mainline Charter release documentation beneath the unchanged application diff. No P0–P2 blocker; prior no-ack and poll-order P1s closed.
- Independent continuity/latency re-review: **CONDITIONAL PASS**, no code blocker; browser-level App lifecycle integration and deployed two-device timing remain evidence gaps.
- Independent hygiene/privacy audit: **CONDITIONAL PASS** pending the then-running full gate; no P0–P3 hygiene/privacy finding, secret, export, private artifact, schema, hosted writer, or Production change.

## Decisions

- Preserve the 4 s/backed-off REST pull as the recovery net. The repair restores Realtime rather than making polling more aggressive.
- A reconnect is transport recovery only. It earns no right to display data; catch-up still uses the command-log/PGlite or snapshot/PGlite paths.

## Remaining uncertainty

- The exact reason the browser socket entered `CLOSED` is not retained in the current diagnostic. The fix must handle browser throttling and network-terminal closure without depending on that unavailable cause.
- Live latency remains unproved until a deployed two-device 100-sample run.
- Unit policy/gate tests cover lifecycle components, but there is not yet a browser-level App integration test that drives focus plus stale channel generations end to end. Independent verification classified this as a non-blocking P2 proof gap.

## Handoff

Local implementation and verification are complete at final application commit `f3ca474` over `8ae8071`; Jonathan authorized push/merge/Development deployment on 2026-09-01. The signed-in two-device 100-sample canary remains required after deployment. At this record the branch is not yet pushed, merged, or deployed.
