# T2-S3 — Materialized snapshot builder

**Tier:** 2  
**Depends on:** T2-S2  
**Risk:** High

## Goal

Rebuild hosted + local snapshot from ordered command events; `financialAuditHash` matches PGlite accept path.

## Allowed scope

- `buildSnapshotFromEvents(events, baseSnapshot)` pure function + tests
- Optional server-side compact job (document only if not implementing)

## Acceptance

- [ ] Golden fixtures: 10 commands → expected hash
- [ ] Tombstones preserved
- [ ] Conflict detection unchanged for same-row diverge

## Cursor prompt

```text
Implement T2-S3 from docs/briefs/sync/T2-S3-materialized-snapshot.md.

Build pure snapshot materialization from continuity_command_events with tests against golden fixtures. Integrate with pull path behind VITE_CONTINUITY_COMMAND_LOG=1. books-auditor required. Handoff with hash proof table.
```
