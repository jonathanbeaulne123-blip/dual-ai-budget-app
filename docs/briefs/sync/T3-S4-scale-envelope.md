# T3-S4 — Scale envelope

**Tier:** 3  
**Depends on:** T1-S3, T1-S5 metrics  
**Risk:** Medium

## Goal

Document and implement channel policy for 10–100 members: Realtime primary, poll backoff table, rate limits unchanged from D-121.

## Cursor prompt

```text
Implement T3-S4 from docs/briefs/sync/T3-S4-scale-envelope.md. Scale policy doc + interval backoff from livePullIntervalMs; load test notes. No claim of 100-person production ready without Realtime. Handoff with scale table.
```
