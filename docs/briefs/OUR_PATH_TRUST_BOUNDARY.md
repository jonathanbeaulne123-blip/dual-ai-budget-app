# Our Path — trust boundary (follow-up to the Our Path world decision, headed D-262 in docs/DECISIONS.md; note the table row D-262 is the cellar kitty jars — the number was used twice)

## What `pathWorld` holds
A synced Shared collection (`src/core/pathWorld.ts`) with three row kinds:
- **recipe**: a proposed change to how a signal shapes the island (name, when, brush, on).
- **name**: the island's name.
- **category**: one member's fix to which Path signal a spending category feeds.

Recipe and name changes take effect only when every active member agrees to the same revision. Category fixes apply as soon as one member sets them.

## Why it is non-money
No row stores amounts, accounts, transactions, or journal facts. The commands post no ids (`postedIds: []`), and the tests check that `financialAuditHash` does not change. The island is *read from* shared months (`src/core/pathSignals.ts`) but never writes back to them. `.claude/rules/money-trust-boundary.md` is not engaged.

## Exposures
1. **Older-client drop.** A client built before D-262 does not know `pathWorld`. It ignores those facts when it replays an event, and a later full-snapshot write from that client's *code* can silently drop the couple's agreed recipes and island name. (A snapshot that merely lacks `pathWorld` cannot drop rows through `mergeShared`, because `mergePathWorld` is a union; only older code writing snapshots can.)
2. **`mergeShared` trusts its input.** `src/core/sync.ts` `mergeShared` (used by `src/core/conflict.ts` `mergeSharedLastEntryWins`) combines rows with `mergePathWorld(server, client)`. That merge is deterministic, but like every Shared collection (Chapters included), it does not re-check who made a change.
3. **Replay authority.** Continuity replay (`src/ledger/materializeSnapshotFromEvents.ts`) refuses `updatePathWorld` events unless `pathWorldRowsValid` and `pathWorldChangeAuthorized(local, incoming, event.member_id)` both pass. A member can only add their own agreement, propose under their own name, fix a category as themselves, and promote a proposal when theirs is the last agreement missing.

## What this slice fixes (exposure 1)
It adds a `pathWorldVersion` capability flag, copying D-245's `taskPlannerVersion`:
- `src/ledgerSync/protocol.ts`: `LedgerCommand.pathWorldVersion?: 1`. `buildCommand` sends `1`, and `parseCommand` refuses any other value.
- `src/ledgerSync/authority.ts` `prepareCommand`: if the household holds island rows (`hasPathWorldData`), or the command has a Path step (`PATH_WORLD_COMMAND_KINDS`), a command without the flag is refused with `CLIENT_RELOAD_REQUIRED: Reload Hearth to preserve your island.`
- `src/ledgerSync/client.ts`: reads the flag from the server's `ready` message. `queueConfirmation` refuses to send (`PATH_UPDATE_REQUIRED`) while not connected or to a server that has not advertised it. The app and the Worker deploy together from `main` (one `wrangler deploy`, D-041), so a new app never meets an old Worker in the ordinary chain.
- `workers/ledgerRoom.ts`: the `ready` message advertises `pathWorldVersion: 1`.
- Note: ledger steps carry the registry kinds (`proposePathRecipe`, `proposePathName`, `agreePathProposal`, `declinePathProposal`, `setPathCategorySignal`). `updatePathWorld` is only the undo/continuity kind. `PATH_WORLD_COMMAND_KINDS` lists all six, so the step check can actually fire.

## What it does not fix
- Exposure 2: `mergeShared` still trusts full-snapshot input, as it does for Chapters and every other Shared collection. Merge behaviour is unchanged.
- Clients that predate the whole flag mechanism are refused by the older per-feature flags once the household holds that feature's data, just as this one is. This slice only closes the gap for island data.

## Request: Codex trust review
Please review these files:
- `src/core/pathWorld.ts` (`hasPathWorldData`, `PATH_WORLD_COMMAND_KINDS`, `pathWorldChangeAuthorized`, `mergePathWorld`)
- `src/ledgerSync/protocol.ts`, `src/ledgerSync/authority.ts`, `src/ledgerSync/client.ts`
- `workers/ledgerRoom.ts` (`ready` message)
- `src/core/sync.ts` `mergeShared`, `src/core/conflict.ts` `mergeSharedLastEntryWins`
- `src/ledger/materializeSnapshotFromEvents.ts` (the `path-world-materialization-invalid` gate)
- Tests: `test/our-path-world.test.ts` ("pathWorld capability guard")

## Addendum — era rows (D-268)
The collection gains a fourth row kind, **era** (the Journey of Life). An era row is an agreement row like recipe and name: words (through `pathWords`), months, a home, a finish rule, plans pointing at shared goal ids, `crossedOn` and `retired`. No amounts. The same agreement machinery, merge and replay authority apply (`pathWorldChangeAuthorized` treats it as an agreement row).

- **Capability:** `pathEraVersion?: 1` mirrors `pathWorldVersion`. `authority.ts` refuses a command without it once `hasPathEraData(current)` or a step is in `PATH_ERA_COMMAND_KINDS` (`proposePathEra`, `proposePathEraPlan`, `crossPathEra`); `client.ts` refuses to send until the server's `ready` advertises it; `ledgerRoom` advertises it. A pre-D-268 client (which would drop era rows when it shapes the collection) is refused on households with a journey. `pathWorldVersion` stays 1, so no island-only household is disturbed.
- **Shape rules:** `assertEraProposalFits` (on propose and again on agree): a crossed era keeps order, months, home, finish rule and `crossedOn`; the current era keeps order and start and cannot be retired; once any bridge has been crossed, nothing new goes before the current era; orders are unique.
- **Crossing:** `crossPathEra` proposes `crossedOn` only when the finish line reads met from accepted books. Replay does not re-check the finish line (the check reads books that replay order may not have yet); a forged crossing still needs every member's agreement under `pathWorldChangeAuthorized`.
- **Please review:** the above, plus `src/core/duplicate.ts` (`refreshDuplicateFlags` windowing) and `src/core/syntheticRuntime.ts` (`atSyntheticClock`, fixture-only).
