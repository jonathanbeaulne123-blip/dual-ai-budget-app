# T1-S4 — Push/pull race coordinator

**Tier:** 1  
**Depends on:** T1-S3  
**Blocks:** T1-S5  
**Risk:** High (lost update / duplicate merge)

## Goal

Single coordinator serializes: local outbox flush, inbound Realtime, poll pull, and user-initiated reconcile. Prevent double-merge, stale Realtime events, and flush-during-pull races.

## Baseline

- Outbox flush on commit, focus, reconnect
- Realtime + poll can fire concurrently after T1-S3

## Allowed scope

- `src/continuityCoordinator.ts` (or extend continuity.ts) with mutex + revision monotonicity
- Ignore inbound events where `remoteRevision <= localTipRevision` unless conflict state
- Dedupe in-flight pull for same household+revision within 100 ms window
- Tests: flush during pull, Realtime during flush, duplicate events

## Forbidden

- Silent drop of higher revision
- Parallel flush without queue

## Acceptance

- [ ] Deterministic tests for 6 race scenarios documented in SYNC_ARCHITECTURE.md §8
- [ ] No duplicate PGlite accepts for same revision
- [ ] Outbox ack only after coordinator confirms success
- [ ] books-auditor PASS

## Cursor prompt

```text
Implement T1-S4 from docs/briefs/sync/T1-S4-push-pull-coordinator.md.

Introduce a push/pull coordinator that serializes outbox flush, Realtime-triggered reconcile, and poll fallback. Enforce revision monotonicity: ignore stale Realtime events; dedupe concurrent pulls. Add deterministic race tests.

Run pnpm test including hosted-cas and live-pull suites. Handoff with race scenario matrix and results.
```
