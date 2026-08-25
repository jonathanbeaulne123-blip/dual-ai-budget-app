# Hearth worksession — Quiet sync + ledger-only undo

- **Status:** OPEN
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Branch:** `cursor/sync-undo-quiet-f375`
- **Baseline SHA:** `b2f3a10` (`main`)
- **Risk:** Medium (command chrome + continuity timing; money meaning unchanged)
- **Decision owner:** Jonathan

## Household outcome

Posting money still syncs immediately and can undo. Hercules, chalk, cosmetics, and other kitchen actions feel instant — no undo toast, no Recent-changes noise, sync flushes in the background.

## Budget delta (5)

`+2` — ledger writes keep sync-on-write + undo; kitchen no longer pretends to be money.

## Engagement delta (3)

`+2` — Hercules/office interactions lose undo popup bloat.

## Scope

- Classify `ledger-write` vs `kitchen-local` via TXN/SHF posted ids
- Toast + Recent history only for ledger writes
- Kitchen transport: enqueue + background flush (UI not blocked on network)
- Ledger transport: still flush immediately after local accept

## Out of scope

- D-124 restore points
- Changing Production D-085 reverse semantics
- Fixed 10s heartbeat timer

## Acceptance evidence

- [ ] Focused tests for writeKind + quiet toast
- [ ] `pnpm check`
- [ ] Post expense → undo toast; chalk/chat → no toast
