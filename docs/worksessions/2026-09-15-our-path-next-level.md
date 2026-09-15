# Hearth worksession — Our Path, next level (D-264)

- **Status:** OPEN — local branch complete; awaiting Codex trust review (capability guard; owner-only footpaths on the household island) and Jonathan's merge
- **Opened:** 2026-09-15 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (orchestrator); Opus sub-agents built and reviewed each slice
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `claude/our-path-next-level`
- **Baseline SHA:** `fe0cb3bb` (origin/main, #489; the island itself merged as #488, D-262)
- **Head SHA:** recorded in the HANDOFF that ships with the bundle
- **PR or issue:** none yet (delivered as bundle + patch)
- **Risk:** High — a new per-feature capability flag on the ledger command (sync); owner-only Personal rows drawn on the household surface (privacy); many UI slices
- **Decision owner:** Jonathan (product); Codex (trust review of `pathWorldVersion` and of the footpaths/bridge privacy rule)
- **Environment impact:** none (local only; fictional habitat books for every proof and capture)

## Household outcome

The island Jonathan and Bianca see on the household **Our Path** tab is now sturdy on a phone and the rest of the app has come onto it. Two small figures — *us* — walk the path together and their footprints fade behind them. Opening the tent no longer rebuilds the world; it sleeps and wakes. The world rests when idle, and a per-device **Full / Lite** quality setting turns shadows and ambient motion off on modest phones.

Then the app arrived: the **Kitty studio lives inside the landmarks** (pressing a bank opens its own room in the tent; a kiln stands on the island and smokes for a month after a firing; coins arc in when money is set aside and out when a cushion is used). The **campfire is a door to Together** (Jonathan's call today: Together stays its own tab); the fire blazes while a Sitdown is open, settles to embers when it closes and the month's land *sets* with a stone kerb; closed-books months are paved, stamped weeks light lanterns; the **Charter** stands as a stone square; agreed **decisions fork the path**; when both people are on the page the fire crackles brighter. The **Calendar comes as weather**: bills are clouds (big ones storms), paydays are sunrises, covered stretches are sunlit road, and forecast mist has a signpost that says why. **Planner tasks are stepping stones** with owner and backup footprints; a money stone lights only when the books confirm it. **Private footpaths** show only to their owner and **"Share with Our Home" builds a bridge plank by plank**. Every month card opens the **Time Machine**. **Hercules waits at the tent in his saved outfit** and leans toward the pawprints when he has a suggestion; **Play is his cottage**; **memory flags carry the board photos**; and **Home has a window** with the island in miniature and a door to it. The little touches: the bottle in an old cove holds the note from that trip, the island's first winter leaves a frost that never quite melts, and the walkers pause at every campfire they pass.

Nothing on the island moves money. Every action is a link, a tab or the tent. The island reads only accepted household-scope facts, and nobody's words carry an amount (digits and `$` are stripped from any user text before it reaches the land).

## Budget delta (5)

+0 to +1. No posting, confirming, reconciling or editing from the island. The island now shows more of what the books already say (bills as weather, paydays, covered stretches, money stones lit by books evidence, Fund cushion signposts) with a door to the real screen every time. `pathWorldVersion` closes the older-client drop for the island's own rows.

## Engagement delta (3)

+3. The island is travelled rather than looked at; the couple's Sitdown, Charter, decisions, banks, calendar, tasks, memories and Hercules all live on it; it costs less battery; and it works from the keyboard and without WebGL.

## Verified baseline

- Facts: on `fe0cb3bb`, the island (D-262, #488) had no capability guard, disposed the WebGL context when the tent opened, rendered continuously with ambient motion, and had no axe run. The Fund `asOf` projector split already existed (D-247), contrary to the D-262 worksession's assumption.
- Facts: five tests fail on the untouched baseline and were re-run on a clean `fe0cb3bb` worktree to prove it: `copy-budget` ×2, `sync-integrity` ×1, `month-spread` ×2 (the last two read copy in `src/KittyBanks.tsx` that #486 changed). None involves a file this branch touches; none is masked.

## Scope

### Part 1 — sturdy (all done)

1. **Trust boundary.** `docs/briefs/OUR_PATH_TRUST_BOUNDARY.md` + `pathWorldVersion` on `LedgerCommand` mirroring D-245's `taskPlannerVersion` through `protocol.ts`, `authority.ts`, `client.ts`, `workers/ledgerRoom.ts` (one flag on the `ready` message; no wrangler/config change). `PATH_WORLD_COMMAND_KINDS` lists the five real registry step kinds (the brief's `updatePathWorld` is only the undo/continuity kind and would never have fired). Flagged for Codex.
2. **Performance.** `world.sleep()/wake()` across the tent; idle pause after 20 s; `IntersectionObserver` pause when scrolled away; `setQuality("full"|"lite")`; a lost WebGL context bumps a world epoch so the island comes back; point lights capped at a fixed pool of three (Full) or the walkers' lantern only (Lite); `PCFShadowMap` named explicitly (three r185 deprecates the soft map). `docs/evidence/our-path-world/PERFORMANCE.md` — **no real phone was available**; SwiftShader numbers only show that the loop stops.
3. **Journey object.** `src/path/walk.ts` + the walkers in the world; the "We are here" mark rides on them; flat-map glyph.
4. **Fund-balance elevation.** Plan only: `docs/briefs/OUR_PATH_FUND_ELEVATION_PLAN.md` (a `cushion` score, never cents; the money-meaning question on `fundLensToday` stays Jonathan's).
5. **Accessibility.** axe 4.13 × three themes × 390/1100 × live / no-WebGL / reduced motion: 42 serious nodes (Taylor contrast, two touch targets) → **0**. Escape closes the card; focus moves into it from the keyboard; one `:focus-visible` rule for every control; marks never sit under controls, the open card, or off the stage edge; a jsdom test proves every place the world receives has a mark and an outline row. `docs/evidence/our-path-world/A11Y.md`.

### Part 2 — the app on the island

Built: steps 1–11 as described above (order followed Jonathan's answer: Kitty studio first, then the Together campfire as a door). Step 12 (personal island) is a privacy review only: `docs/briefs/OUR_PATH_PERSONAL_ISLAND_PRIVACY_REVIEW.md` (recommendation: derived-only v1, a door from the Personal Home, no new store).

New pure read-models in `src/core/`: `pathWeather.ts`, `pathStones.ts`, `pathLand.ts`, `pathFootpaths.ts`, `pathBridges.ts`, `pathWords.ts`. New `src/path/`: `walk.ts`, `landmarks.ts`, `together.ts`, `bottle.ts`, `memoryPhotos.ts`, `PathMiniMap.tsx`. New `src/boardMedia/householdBoardMedia.tsx`. Small hooks outside the island: `TimeMachine` `initialPeriod`; `PlanStudio` `section: "bridge"` source focus; `KittyBankRoom` follows a repeated landmark request; `HouseholdLife.acceptedPlan` exported; `QueenHome` window; `HerculesNumberSource.section`.

### Out of scope / stayed off the island

Add/Confirm, Books and register, reconciliation, Fund position (the Standing Book stays a book — the island only has an "Open the Fund" door), Work/shifts, settings. Fund-balance elevation and the personal island are plans. Production, schema, Auth, the `hearth-books` Worker config and the Personal Plan tab are untouched.

## Acceptance evidence

- [x] `pathWorldVersion` carried, refused when ≠ 1, old client refused once rows exist or a Path step is sent, money command from an old client still posts while no rows exist (`test/our-path-world.test.ts`)
- [x] Tent round trip creates no second world; sleep/wake; quality persists per device; a lost context rebuilds (`test/our-path-world-ui.test.ts`)
- [x] Walkers: flat glyph moves with the slider; `walkPath` deterministic and reversible
- [x] Weather/stones/land/footpaths/bridges/words read-models: 8 + 7 + 4 + 6 + 5 + 5 tests, fictional data, personal rows excluded, no amounts in copy, partner render shows nothing private
- [x] Landmark opens its own bank in the tent; kiln warm/cold; step per shown month; story line
- [x] "Sit down together" → Together; Charter square signed/waiting; forks → agreement line in the tent; Sitdown open/closed → fire state and set land; presence count
- [x] Month card → Time Machine at that month; cottage → Play; Hercules `aria-hidden` at the tent; board photo on a flag; Home window door
- [x] Every place reachable from marks and outline; Escape/focus; axe 0 × 12 runs
- [x] Browser evidence: `docs/evidence/our-path-world/next-level/` — classic, taylor, newfoundland × 320/390/720/1100/1440, plus hard-story Stop with a card, reduced motion, no-WebGL flat map, outline, tent, empty household (21 captures, `INDEX.md`): zero page errors, no horizontal overflow; one favicon 404 on the first page. Slice captures (`journey-*`, `kitty-*`, `together-*`, `weather-*`, `stones-*`, `controls-*`, `guide-*`, `footpaths-*`, `bridge-*`) in the same folder.

## Evidence log

- Quick gate on the integrated branch: `pnpm test -- --risk=high --focus=test/our-path-world-ui.test.ts --focus=test/our-path-world.test.ts` → 640 of 642 pass (229.8 s of 300 s, no budget breach); the two failures are `month-spread` ×2, pre-existing on `fe0cb3bb`. Every slice's own gate is recorded in the orchestration log below; the guard, perf, journey, weather-core, Kitty, stones/land and Together slices each reported `quick-gate-passed`; later slices report `quick-gate-failed` solely on the baseline `month-spread` pair once the gate's selection started including it.
- `pnpm exec tsc --noEmit` clean after every merge.
- The island suites at head: `our-path-world-ui` 35, `our-path-world` 20, `path-weather` 8, `path-stones` 7, `path-land` 4, `path-footpaths` 6, `path-bridges` 5, `path-words` 5, `path-minimap` 4, `time-machine-ui` 8, `plan-life-ui` 4, `queens-nest-ui` 24, `planner-tasks` 8, `app-startup-p1` 82 (D-183 Bianca regression) — all green.

## Orchestration log (who built and reviewed what, and what changed after review)

| Slice | Built by | Reviewed by | Changed after review |
|---|---|---|---|
| 1a guard | Opus builder (`slice/path-guard`) | Opus read-only reviewer | doc comment re-attached; `hasPathWorldData` short-circuit; no-rows money-command test; trust-note wording |
| 1b perf | Opus builder (`slice/path-perf`) | same reviewer | rebuild after lost context (`worldEpoch`); `PCFShadowMap` |
| 1c journey | Opus builder (`slice/path-journey`) | — (covered by later reviews) | walkers pause at campfires (built later) |
| 1d elevation plan | Opus planner (read-only) | — | written to `docs/briefs/` |
| 4-core weather | Opus builder (`slice/path-weather-core`) | later reviewer | — |
| 2 Kitty | Opus builder (`slice/path-kitty`) | Opus Part-2 reviewer | kiln piece renamed "A kiln hut"; behaviour test; repeated landmark request |
| 5/10 core stones + land | Opus builder (`slice/path-core-stones-land`) | Part-2 reviewer | stones' evidence filtered to the shared ledger |
| 1 Together + 10 land | Opus builder (`slice/path-together`) | Part-2 reviewer | forks/decision words stripped of digits |
| 4 weather + 5 stones + touches | Opus builder (`slice/path-weather-stones`) | Part-2 reviewer | — |
| 7/8/9/11 guide | Opus builder (`slice/path-guide`) | Part-2 reviewer | `initialPeriod` applied once; scene no longer rebuilds per App render; stale tent focus cleared |
| 6 footpaths + bridge | Opus builder (`slice/path-footpaths`) | Part-2 reviewer | Mine key per member; private marks never at Dim; D-264 entry; privacy-review addendum; `section: "bridge"` |
| 12 privacy review | Opus writer (read-only) | — | — |
| 1e a11y + evidence | Opus builder (`slice/path-a11y`) | — | — |
| review fixes | Opus builder (`slice/path-review-fixes`) | — | orchestrator: Hercules sizes with the camera; labels never hang off the stage edge |

The orchestrator merged every slice in order onto `claude/our-path-next-level`, re-ran `tsc` and the island suites after each merge, and ran the High quick gate on the integrated branch.

## Decisions

- Jonathan, 2026-09-15: the Together tab stays its own tab; the campfire on the island is a door to it. Step 2 starts with the Kitty studio, then the Together campfire.
- Recorded as D-264 (with a numbering note: the island's founding decision keeps the D-262 heading; the table's D-262 row is the cellar kitty jars and D-263 the loft rack).

## One step further

Built in this branch: walkers pause at campfires; the bottle holds the trip's note; the first frost; the fire crackles brighter when both are here; Hercules leans toward the pawprints; the compact "Lite" toggle on phones; flat-map kerbs and stamps; stones' footprints for owner and backup.

Parked, each with the smallest next step:

1. **A lit money stone clears its cloud.** When the books confirm a bill's task, fade the matching cloud and lay a sunlit ribbon under the stone. Smallest step: `src/path/clearedClouds.ts` returning `bill:*` ids whose linked task is lit; the page marks those clouds `cleared`.
2. **"You have a plank to share."** When `pathBridges` has a stage-1 draft for this month, add that line to the tent mark's sub. Uses data the page already has.
3. **Hercules walks the pawprints.** When a `?` signpost card opens, move the DOM Hercules to that anchor (no movement under reduced motion). ~10 lines in `applyAnchors` plus one test.
4. **The landmark tells every firing.** `kittyFiringStory(studio)` → up to three `{ date, glaze }` for the Bright-lantern line.
5. **Fund-balance elevation.** Sequence in `OUR_PATH_FUND_ELEVATION_PLAN.md`: Jonathan's two answers → `fundBalanceSeries` PR + Codex review → the `cushion` score and the plinth rise.
6. **Personal island (derived-only).** After the shared island lands: a door from the Personal Home, base recipes read-only, Dim by default, its own lantern key.
7. **Board photo crops.** Honour `crop` on the flag texture instead of centre-cropping.
8. **Flat map parity.** Pass the same avoid list to `charterSpot` in `PathMiniMap` so the square sits where the 3D one does.

## Remaining uncertainty

- **Codex trust review needed** for (a) `pathWorldVersion` — the app and Worker deploy together from `main`, so a new app never meets an old Worker in the ordinary chain, but a stale tab on a D-262-era build is refused with `CLIENT_RELOAD_REQUIRED` once island rows exist (same as the planner guard); (b) owner-only footpaths and stage-1 planks on the household island — derived on the device from the owner's own Personal rows, nothing synced, never at Dim, Mine key per member; the partner-render test proves nothing crosses devices, but the shared-screen glance risk is a product call.
- **No real device.** Frame rate and battery were not measured; SwiftShader only proves the loop stops and the capture set has no page errors.
- **`mergeShared`** still trusts full-snapshot input, as for every Shared collection.
- `pathWeather`: when a bill exceeds the Fund balance the horizon refuses (`baseline-untied`), so the island shows "No forecast yet" rather than mist; dropping personal rows makes storm shares read against a smaller total.
- The tent has no card, so "Hercules has a suggestion" lives on the tent mark's sub and the campfire card.
- "Open my planner" on a footpath reuses the household planner link.
- Screen readers were not heard (no VoiceOver/NVDA run).

## Handoff

Local branch only, delivered as bundle + patch + HANDOFF. Not pushed, not a PR, not merged, not deployed, not live-verified. Next owner: Codex for the two trust reviews, then Jonathan to merge through the usual delivery chain, then a real-phone pass on Full and Lite.
