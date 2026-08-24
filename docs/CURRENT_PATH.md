# Current command path freeze (main @ 6559dd8)

Recorded 2026-08-24 before the trust-foundation rewrite. Inspected on `main`; not restored from an older branch.

## Household outcome today

A visible Confirm runs a pure command (`postEntry` / `postTransfer` / `postShift` / …). `commit()` clones JSON, stamps `lastCommittedAt`, and returns a new snapshot. **It does not ingest PGlite and does not bump `revision`.**

`App.commitHousehold` then:

1. `saveHousehold(next)` — localStorage first, IndexedDB best-effort (errors swallowed).
2. `setHousehold(next)` — UI treats the write as saved.
3. If `linked`, reconcile + `pushSharedHousehold`.
4. `syncHouseholdBooks(stored)` which **always** `pushSupabaseHousehold({ ...household, linked: true })`.

Boot loads JSON, optionally reconciles if linked, then calls the same `syncHouseholdBooks` for every household, including demo / empty / unlinked.

## Places that can violate the household outcome

| Failure | Where | Effect |
|---|---|---|
| Mutate before books validation | `commands.commit` then `App` save | JSON/UI commit before PGlite |
| Swallow ingest error | `writeBooks` returns `{ ok: false }` after INSERT | Unbalanced journal can sit in PGlite; App still has JSON |
| Publish before local acceptance | `syncHouseholdBooks` pushes even when ingest `ok: false` | Hosted snapshot can precede valid books |
| Retry non-idempotently | Confirm has no command identity | Double-click / retry can post twice |
| Overwrite a newer snapshot | `households?on_conflict=id` and `household_snapshots?on_conflict=household_id` | Last writer wins; no CAS |
| Wrong Development/Production key | Storage keys by `environment`; pull filters column but payload is not re-checked | Pill and payload can disagree |
| Hosted call from unlinked household | `syncHouseholdBooks` + bundled publishable key | Demo/empty/unlinked/Pass can upload |
| Show success without proof | UI updates after `saveHousehold`, before ingest | Toast/state can say saved while books failed |
| Assemble forces linked | `assembleHousehold` sets `linked: true` | Hearth Pass / merge can look hosted |
| Push forces linked | `pushSupabaseHousehold` writes `linked: true` | Transport mutates mode |
| Undo restores a whole snapshot | `undo()` | Partner rows posted after the token can disappear (tombstones help; still a snapshot restore) |

## Required successor

One `acceptHouseholdWrite` boundary: validate → compile → cents/balance → PGlite ingest (throw/rollback) → persist JSON → optional linked transport. Failure at any step keeps the previous valid household readable and unpublished.
