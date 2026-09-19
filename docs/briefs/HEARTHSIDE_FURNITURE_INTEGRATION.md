# P10 — Give the furniture a place that feels like us

Target AI / integration owner: root Codex. Decision owner: Jonathan. High risk because saved room layouts cross canonical admission, immutable history and guest review. Budget delta (5): no money mutation or new financial authority. Engagement delta (3): the couple can arrange the actual authored furniture and preserve a deliberately reviewed room.

Branch `codex/hearthside-furniture` starts at P12 `d6db17b041edbd7156e185eecb28d46a3042c562`. The exact read-only root RoomScene dependencies used before furniture changes were blob `f03c8cceaf99e8bd420e6af46ff31b676ef7417e` for `RoomScene.tsx` and `a2ff838677ca4f7faafc2b6c78c474403bcf853b` for `roomScene.css`. Those files were absent from this branch's base, so the commit adds them; integrate their delta against these blobs to avoid replacing newer root work. No package, lock, binding or dependency changes.

## API and invariant laws

`roomFurniture.ts` is dependency-free, shared by browser and Worker. Its closed catalogue has 14 stable semantic identities across four rooms and three themes. Version 1 positions are 0.08–0.92 in 0.001 increments, with 0.5 as the authored default. They express a position within that piece's bounded space; per-piece travel preserves authored staging. They are not money growth, physical production units or AR poses. Theme materials remain different; the same position changes the same corresponding authored piece in each theme. New coordinate meanings require a new version; never silently reinterpret existing version-1 records.

- `FurniturePlacement = {room, furnitureId, revision, x, y}`. Only an allowlisted piece in its own room is accepted; no caller-supplied author, source object, scale or balance fields.
- `FurnitureMove = {room, furnitureId, expectedRevision, x, y}`. Call `applyFurnitureMove(current ?? [], value)` **inside the existing authenticated canonical command boundary**. It performs a per-piece CAS and increments revision itself. An absent record has revision 0. Same-piece stale edits fail; unrelated furniture edits do not invalidate the draft.
- `RoomFurnitureLayout = {version:1, room, placements}`. `captureRoomFurniture(room, current)` returns detached, complete records including frozen defaults. `decodeRoomFurniture` requires that complete room-specific set, not a partial live overlay.
- `RoomScene` receives `furniture`, `scopeKey`, `onArrangeFurniture(move):Promise<void>` and `furnitureSaveAvailable`. Resolve the callback only after canonical confirmation; reject uncertain/failed saves. Keep the callback present when temporarily offline/busy, and change `furnitureSaveAvailable` so the pending form and draft remain visible. Read-only/history/guest callers omit the callback.
- Root must key the Scene by environment/household/acting member, as in the patch. Local drafts reset on room or scope changes, and they never become shared state without Save. A newer exact-piece revision retains the draft, disables stale Save, and offers explicit “Use latest position.” Cancel/Escape returns focus to the originating native control. Keyboard sliders and handle arrows use 0.001; Shift+arrows use 0.01. Pointer movement uses the SVG screen matrix, including phone cropping/scaling, and moves the actual artwork plus its attached tools, cloth and pottery.

## Exact integration patch

`patches/hearthside-furniture-root.patch` targets the current root files listed with their exact input blobs in `patches/hearthside-furniture-root-bases.json`. Review/apply this patch in root, not in this isolated worktree. The packet modifies:

1. `contracts.ts`: optional `furniture` collection in HearthsideState, strict decode and existing total metadata bound.
2. `commands.ts`: `furniture.save` discriminant with exact keys `kind,value`, invoking the helper after existing scope/member admission. This uses the ordinary single Hearthside operation; no second ledger or money path.
3. `HouseholdRoom.tsx` and its `Hearthside.tsx` call: complete layout, stable scope key, async confirmed save and separate availability.
4. `roomHistory.ts`: new captures include the full immutable layout; initial admission rejects missing or stale layout. Older records without furniture retain frozen version-1 defaults. Keeping or displaying a recorded room does not compare against today's furniture.
5. `RoomHistory.tsx`: render `frame.furniture`, never current state furniture.
6. `workers/hearthsideGuestSource.ts`: construct `furniture: room => captureRoomFurniture(room, state.furniture ?? [])` from the detached canonical snapshot supplied to the guest catalogue.

`workers/ledgerRoom.ts` needs no new direct mutation RPC: existing `commitHearthside` admission serializes the command, its pure helper performs CAS, and the existing nonfinancial guard compares everything except allowed Hearthside metadata. Existing archive/event/member-snapshot limits continue to apply. Guest capture already snapshots accepted sequence and final-checks it outside media callbacks. The new catalogue field follows that exact snapshot and therefore joins the same prepare → validate → accept → activate barrier. Verify these seams with the actual integration tests below.

Financial recovery already preserves the full `hearthside` object via `currentSharedLifeRecords`; furniture and recorded layouts must remain current during a financial restore. Ordinary snapshot projection, personal projection, command replay and private backup carry the strict decoded metadata. Do not reconstruct furniture from the restored books, goals, painting or today's theme.

## Guest copies

This package changes `guestContracts.ts`, `guestProjection.ts`, `GuestRoomView.tsx`, and their fixtures/tests. Every new capture copies a complete canonical furniture layout into the arrangement digest. Both members review that exact arrangement. Changed furniture before activation fails source validation. Active visits and R2-restored copies read only their stored arrangement; `validateGuestSources(...,'visit')` never calls the live furniture resolver. Furniture IDs are closed authored names, not source capabilities; there are no financial fields or host identity in the layout. Legacy pre-furniture copies remain byte/digest-compatible by omitting the field and rendering the frozen authored defaults. Do not opportunistically fill them from current source state. A new room/layout requires a new reviewed publication.

## Evidence and required integration acceptance

Local browser proof uses real RoomScene React/SVG and a test-only serialized HTTP store invoking the same CAS helper. It verifies direct-art and handle dragging, SVG transforms, all furniture identities in 84 room/theme/width combinations, explicit cancel, 0.001/0.01 keyboard precision, same-piece two-page races, reload/member/household return, existing object drag, reduced motion, 200% text and native actions. This is not a claim of actual Google Auth, physical devices or LedgerRoom integration. The separate guest runtime tests use the real guest Worker/SQLite DO/R2 classes, including layout-change activation denial and unchanged visit copies after later live rearrangement.

Root should add actual LedgerRoom tests for: two active actors racing the same furniture revision; independent-piece saves; forged actor/inactive/replaced member/environment and unexpected operation fields; unknown furniture, fractional coordinates, malformed accessors; lost acknowledgement retry with the existing confirmation ID; personal projection/backup/replay equality; financial restore preserving current furniture and immutable room frames; captured history rejecting omitted/stale layout; guest activation rejected after furniture movement; guest visit and archive restore retaining the old layout. The isolated helper and browser server intentionally do not replace those checks.

No hosted action, flag activation, schema apply, external upload, email or sent invitation occurred. Full program and physical/authenticated acceptance remain root's responsibility. Scoped quick evidence is not a deployment decision.

Final package evidence: scoped High gate **25/25 tests**, **92.263s**, TypeScript **23.173s**, no five-minute breach. Furniture browser matrix **84 combinations**, **13 axe scans** including the active arranger; guest regression matrix **126 combinations**, **nine axe scans**. Full-size updated captures were inspected. Details, exact command and source fingerprint are in `docs/worksessions/2026-09-12-hearthside-furniture.md`. The root integration patch passed `git apply --check` without being applied. No dependencies changed. Verdict remains **CONDITIONAL for integration** until root closes the actual authority and application checks above.
