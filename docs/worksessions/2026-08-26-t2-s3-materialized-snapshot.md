# T2-S3 handoff — Materialized snapshot builder

- **Status:** OPEN (builder + pull path behind flag; hosted compact documented only)
- **Branch:** `cursor/t2-s3-materialized-snapshot-7270`
- **Depends on:** T2-S2 slim outbox + Migration 013
- **Risk:** High

## Household outcome

When `VITE_CONTINUITY_COMMAND_LOG=1`, the client can rebuild a hosted snapshot from ordered `continuity_command_events` and verify `financialAuditHash` against the snapshot tip before accepting a pull. Materialization facts are resolved at flush time (not stored in the durable outbox).

## Dual Course

- **Budget (5):** +2 — command-log replay path; hash-gated pull replaces blind snapshot trust when events prove out
- **Engagement (3):** 0

## Hash proof table

| Fixture | Commands | Expected hash source | Materialized match |
|---------|----------|------------------------|-------------------|
| Golden chain | 10 × `postEntry` | `acceptHouseholdWrite` tip | ✅ identical `financialAuditHash` |
| Post + undo | post → `undoLedgerConfirm` | flush-shaped `extractMaterializationFacts` | ✅ identical hash; tombstone retained |
| Same-row diverge | post + conflicting amount | conflict row unresolved | ✅ no silent overwrite |
| Pull path | 1 × hosted event + snapshot tip | `pullHouseholdSnapshotById` | ✅ note preserved |

## Files

| File | Change |
|------|--------|
| `src/ledger/materializeSnapshotFromEvents.ts` | `buildSnapshotFromEvents`, facts extraction, catalog base |
| `src/ledger/continuityCommandLog.ts` | Facts at flush via `compactedCommandPayload(household)` |
| `src/ledger/supabase.ts` | `fetchContinuityCommandEvents`, hash-gated pull materialization |
| `src/continuity.ts` | Pass household into compacted payload |
| `test/materialize-snapshot-from-events.test.ts` | Golden + undo + conflict |
| `test/materialize-snapshot-pull.test.ts` | Pull integration |

## Verification

```text
pnpm exec vitest run test/materialize-snapshot-from-events.test.ts test/materialize-snapshot-pull.test.ts test/continuity-command-outbox.test.ts test/continuity.test.ts
```

## Uncertainty

- Undo tombstones with empty `postedIds` rely on `acceptedAt === tombstone.deletedAt` correlation at flush; multi-undo same-ms batches are untested.
- Server-side hosted compact job is **not** implemented (brief allows document-only).

## Next owner

**T2-S4:** Realtime on `continuity_command_events` INSERT; apply single event locally.
