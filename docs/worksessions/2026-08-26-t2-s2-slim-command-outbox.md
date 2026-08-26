# T2-S2 handoff — Slim command outbox

- **Status:** OPEN (client wiring behind flag; legacy drain preserved)
- **Branch:** `cursor/t2-s2-slim-outbox-7270`
- **Depends on:** T2-S1 Migration 013 + T1 Auth atomic push
- **Risk:** High

## Household outcome

When `VITE_CONTINUITY_COMMAND_LOG=1`, new outbox enqueues store **command receipt refs** in durable storage (no journal). Flush calls `append_continuity_command` (013) with materialized snapshot payloads resolved at flush time. Legacy snapshot-tip rows keep using `pushSupabaseHousehold` until drained.

## Dual Course

- **Budget (5):** +2 — ref-only durable outbox; command-log flush path
- **Engagement (3):** 0

## Outbox schema

| Field | snapshot-tip (legacy / flag off) | command-ref (flag on) |
|-------|----------------------------------|------------------------|
| `snapshot` | memory-only tip | memory-only tip |
| `commandRefs` | absent | bounded receipt refs |
| `transportKind` | `snapshot-tip` | `command-ref` |
| Durable LS/IDB | slim pointer (D-145) | refs + pointer, no journal |

## Files

| File | Change |
|------|--------|
| `src/ledger/continuityCommandLog.ts` | Flag, ref builder, compacted payload |
| `src/ledger/supabase.ts` | `appendContinuityCommand` client |
| `src/continuity.ts` | Enqueue + flush routing |
| `test/continuity-command-outbox.test.ts` | T2-S2 acceptance |

## Verification

```text
pnpm exec vitest run test/continuity-command-outbox.test.ts test/continuity.test.ts
```

## Next owner

**T2-S3:** materialized snapshot builder from event log.
