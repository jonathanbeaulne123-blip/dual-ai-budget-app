# Hearth worksession — Our Path becomes a world

- **Status:** OPEN — local branch complete; awaiting Codex trust review of the new shared collection
- **Opened:** 2026-09-15 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `claude/our-path-world`
- **Baseline SHA:** `e8e2f09` (origin/main, #483)
- **Head SHA:** recorded in the commit that closes this file
- **PR or issue:** none yet (delivered as bundle + patch)
- **Risk:** High — a new synced Shared collection (sync, command identity, replay)
- **Decision owner:** Jonathan (product); Codex (trust review of `pathWorld` sync)
- **Environment impact:** none (local only; fictional habitat books for evidence)

## Household outcome

The household **Our Path** tab opens on an island grown from the couple's shared months. Good months bloom, lean months dry and then green again, storms leave a creek and, once money is set aside again, a bridge. Milestones leave monuments. Trips carve coves, cliffs or a lit pier, and going back to the same place deepens the same cove. Chapters are campfires, the open Chapter's Moves are stepping stones, graduated Rituals are lampposts, kept Wins are photo flags and shared Kitty Banks stand as landmarks at their real backing step. Distance and a per-person lantern (Dim / Warm / Bright) decide how much the page says. A **tent** opens today's Our Path (Chapter room and Plan Studio), which stays mounted so drafts survive.

The couple shape what grows: recipes (which score grows what), the island's name, and Hercules's suggestions for parts of life the island has not seen yet all change only when **both** agree. Category → score guesses can be fixed by either person.

## Budget delta (5)

+1. Nothing posts and no figure changes. The island reads only accepted household-scope facts (shared transactions, shared goals and contributions, Fund `kitty-released` events, Chapters, Rituals, Moves, Wins, Sitdowns, household calendar events). Kitty landmarks use `kittyBankBackingStep` (real money set aside), and the weather layer uses `monthObligations`. Health categories never feed a score. Personal-only spending never reaches the island (tested).

## Engagement delta (3)

+3. Our Path becomes a place the couple returns to: a replayable history of their life together, their own island name, and landscape rules they choose together.

## Verified baseline

- Facts: on `e8e2f09`, household Our Path = header + `ChapterRoom` + `PlanStudio` (with `KittyBanks` as goals content), `App.tsx` 6997–7043. Chapters, Rituals, Moves and Wins exist (`src/core/chapters.ts`, D-243+) and are wired through sync, identity and replay without a capability guard. There is no Journey object.
- Facts: `test/copy-budget.test.ts` (2) and `test/sync-integrity.test.ts` (1) already fail on the untouched baseline.
- Inference: the habitat fixtures (`generateDemoSuite` profiles `habitat-well` / `habitat-hard`) are the right fictional books for evidence, because they already carry twelve months, Chapters and shared goals.

## Scope

### In scope

- `src/core/pathWorld.ts`: the Shared `pathWorld` collection (recipe overrides and additions, the island name, category → score corrections). Fail-closed shaper, revision-aware merge with read-time agreement promotion, member-validated commands (`proposePathRecipe`, `proposePathName`, `agreePathProposal`, `declinePathProposal`, `setPathCategorySignal`), and the kind `updatePathWorld`.
- Wiring mirrors Chapters: `types.ts`, `sync.ts` (shape, split, assemble, merge), `visibility.ts` (AI disclosure empties it), `importParity.ts`, `registry.ts`, `commandIdentity.ts` (identity + materialization facts), `commandRuntime.ts` (materialization hash), `materializeSnapshotFromEvents.ts` (facts, extraction, apply, validation `path-world-materialization-invalid`, hash), `continuityCommandLog.ts`.
- `src/core/pathSignals.ts`: 18 month scores, tags, trip naming and month character (pure).
- `src/path/grow.ts`: the deterministic grower. `src/path/world/pathWorld3d.ts`: the lazy three.js world with three authored skins. `src/path/OurPathWorld.tsx` and `our-path-world.css`: the page.
- `App.tsx`: the household branch renders `OurPathWorld`, with today's page as the tent room. The personal Plan is unchanged.
- `scripts/serve-our-path-world-proof.mjs`: the fictional proof page.

### Out of scope

- Journeys, a model-backed Hercules proposal (the suggestion is on-device), live partner presence, elevation from the Fund balance (needs the `asOf`/`period` projector split), personal islands, and any capability guard (Chapters set the precedent of none; see uncertainty).

## Acceptance evidence

- [x] Recipes and name change only on both agreements; stale revision refused; non-member refused (`test/our-path-world.test.ts`)
- [x] Concurrent agreements from two phones converge and promote at read time; promoted beats pending; higher revision wins
- [x] Shapers fail closed; the collection lives in Shared only; AI disclosure empties it; `financialAuditHash` unchanged
- [x] Identity changes; direct replay reproduces the rows; missing facts, a stranger member and tampering are refused
- [x] Month scores read only shared facts; Personal fun never shows; the month in progress is never judged; history caps at 36 months
- [x] The page works without WebGL; the lantern persists per device; a two-acknowledgment Move can only be done after both; the tent keeps a draft alive; naming needs both; category fix and recipe proposal (`test/our-path-world-ui.test.ts`)
- [x] Browser evidence, three themes × 320/390/720/1100/1440, hard story at Stop with a card, the tent round trip, a replay midway and an empty household: `docs/evidence/our-path-world/`

## Evidence log

- `pnpm test -- --risk=high --focus=test/our-path-world.test.ts --focus=test/our-path-world-ui.test.ts` → `quick-gate-passed` (first run 72.7 s of 300 s; rerun after the review fixes 73.6 s).
- Additional runs (`--maxWorkers=1`) after the review fixes: `app-startup-p1`, `month-rehearsal-mainline`, `five-boards-entry-app`, `plan-life-ui`, `vision-v2-chapters`, `materialize-snapshot-from-events`, `ledger-import-parity` and `continuity-command-interleaving` → 137/137. Also `ledger-import-parity`, `materialize-snapshot-from-events`, `materialize-snapshot-pull`, `continuity-command-interleaving`, `kitty-nest`, `vision-v2-chapters`, `habitat` and `queens-nest-ui` all pass. `copy-budget` and `sync-integrity` fail identically on the baseline.
- Browser: `node scripts/serve-our-path-world-proof.mjs` plus Playwright/SwiftShader. 24 captures. Every capture has `data-live="true"`, zero horizontal overflow and zero page errors. Classic, Taylor and Newfoundland at 320/390/720/1100/1440. Tent opens (island hidden, room visible) and returns live. Replay walks the months.

## Independent review (subagent, read-only) and what changed

The review found no gap in the wiring parity and no privacy leak. What was fixed:

1. **Hercules source links.** A source link aimed at the Plan now opens the tent (`openTentFor`), so the focus lands on a visible page.
2. **Labels.** Labels without an anchor (layers off, months not yet grown during replay, goals past six) are now hidden. The lantern now refreshes the labels without a camera move.
3. **Long histories.** The spiral scales with the household's history and the grid grows to 184, so the newest month stands on land for all 36 months (tested).
4. **Replay authority.** `pathWorldChangeAuthorized`: a replayed event may only add the actor's own agreement, proposal or category fix, and may promote only when the actor's agreement is the last one missing (tested with a forged partner agreement that carries a valid hash).
5. **Muted categories.** A category set to "Nothing on the island" no longer comes back as a suggestion.
6. **Tent focus.** Focus moves to "Back to the island" and back to the tent button.
7. **Same proposal twice.** Proposing exactly what is already pending counts as agreeing.
8. **Merge ties.** An exact timestamp tie in the merge resolves the same way on every replica.
9. **Shaping.** The collection is stored shaped, the shaper sorts before it caps, and over-long category ids are refused.
10. **Recipe drafts.** A draft now resets only when the agreed recipe changes.
11. **Smaller fixes.** The scene is built once when the world wakes. The page is keyed by ledger scope. `cur` is clamped. The message in a bottle has its own button.

Not changed, and noted:

- Opening and closing the tent disposes the WebGL context and recreates it. *(Later on 2026-09-15, slice/path-perf: the world now sleeps through the tent. See `docs/evidence/our-path-world/PERFORMANCE.md`.)*
- With ambient motion on, the loop renders continuously and shadows stay on. *(Later on 2026-09-15, slice/path-perf: a 20 s idle pause, a pause when scrolled out of view, and a per-device Lite tier with no shadows.)*
- The full-snapshot `mergeShared` path trusts its input, as it does for every Shared collection.

## Decisions

- Jonathan, 2026-09-15: one world (the growing island is the ground); a new shared collection in this patch; Hearth guesses category scores and people fix them; the personal Plan is unchanged; no feature flag, as long as today's Our Path is reachable from the tent; Hercules may propose new biomes and pieces as data, with both approving; every score imaginable.

## Remaining uncertainty

- **Trust review needed (Codex):** the `pathWorld` collection follows the Chapter precedent, so there is **no capability guard**. Replayed events are authority-checked per actor, but full-snapshot merges are not. An older client ignores the unknown `pathWorld` facts when replaying an `updatePathWorld` event, so it does not show the rows. Whether a later full-snapshot write from that client can drop them is the open question, and it is the same exposure the Chapter collections already carry. Codex decides whether a `pathWorldVersion` guard (the D-242 / D-245 pattern) is required before merge.
- `mergePathWorld` resolves two different proposals at the same revision by newest `updatedAt`; the losing proposer sees their suggestion replaced. This is a conscious choice.
- Real-device performance and battery were not measured. The world renders on demand and loops only while ambient motion runs.
- No axe run. Label collisions are resolved greedily by priority, so some labels wait until you move closer.
- Landmark positions follow the island's radius, so they drift outward as months are added.

## Handoff

Local branch only, delivered as bundle + patch. Not pushed, not a PR, not merged, not deployed, not live-verified. Next owner: Codex for the trust review of the collection and the capability-guard call, then Jonathan to merge through the usual delivery chain.
