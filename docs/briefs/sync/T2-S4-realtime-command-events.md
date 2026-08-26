# T2-S4 — Realtime on command events

**Tier:** 2  
**Depends on:** T2-S1, T1-S3 pattern  
**Risk:** Medium

## Goal

Subscribe to `continuity_command_events` INSERT; apply single event locally instead of full snapshot pull when command-log mode on.

## Acceptance

- [ ] Smaller websocket payload than snapshot row
- [ ] Fallback to snapshot pull if event apply fails validation

## Cursor prompt

```text
Implement T2-S4 from docs/briefs/sync/T2-S4-realtime-command-events.md.

Add Realtime subscription on continuity_command_events INSERT when VITE_CONTINUITY_COMMAND_LOG=1. Apply single event through PGlite accept; fallback to snapshot pull on failure. Tests + privacy auditor. Handoff with payload size comparison.
```
