# T2-S4 handoff — Realtime on command events

- **Status:** OPEN (client wiring behind flags; Migration 014 publication proposed)
- **Branch:** `cursor/t2-s4-realtime-command-events-7270`
- **Depends on:** T2-S3 materialization + T1 Realtime attach pattern
- **Risk:** Medium

## Household outcome

When `VITE_CONTINUITY_COMMAND_LOG=1`, the kitchen subscribes to `continuity_command_events` INSERT over Realtime and applies a single bounded event through PGlite accept — avoiding a full snapshot pull when the local revision matches. Validation failure or revision gap falls back to the existing snapshot pull path.

## Dual Course

- **Budget (5):** +1 — smaller partner-visible transport; hash-checked single-event apply
- **Engagement (3):** +1 — faster partner post visibility without full snapshot JSON over the wire

## Payload size comparison

| Payload | ~Bytes (50-txn stress household) | Notes |
|---------|----------------------------------|-------|
| `continuity_command_events` INSERT row | ~1.2 KB | one command + materializationFacts for posted ids |
| `household_snapshots` row | ~45 KB+ | full shared projection JSON |
| Ratio | **< 10%** | `compareContinuityPayloadBytes` test proof |

## Files

| File | Change |
|------|--------|
| `src/continuityRealtime.ts` | Command INSERT subscription + parse |
| `src/continuityRealtimePolicy.ts` | Attach when REALTIME or COMMAND_LOG |
| `src/ledger/materializeSnapshotFromEvents.ts` | `applyCommandEventLocally`, parse row |
| `src/App.tsx` | Event apply → accept; fallback `replay()` |
| `supabase/migrations/014_realtime_publication.sql` | Add `continuity_command_events` when 013 applied |
| `test/continuity-command-realtime.test.ts` | Apply, fallback, privacy, size |

## Verification

```text
pnpm exec vitest run test/continuity-command-realtime.test.ts test/continuity-realtime.test.ts test/materialize-snapshot-from-events.test.ts
```

Privacy auditor: **PASS** (RLS + PGlite accept boundary preserved).

## Uncertainty

- Migration **014** not applied on Dev — command Realtime events require publication row for `continuity_command_events`.
- `VITE_CONTINUITY_REALTIME=0` with `VITE_CONTINUITY_COMMAND_LOG=1` attaches command channel only (no snapshot signals).

## Next owner

**T2-S5:** interleaving + conflict spec harness (same-row, reversal, personal scope).
