# src/journey — the Journey map (Horizon Clock)

The household Journey surface (route `{room:"kitchen-table", level:"above", surface:"journey"}`, view household) and
the illustrated edition's arrival home: a clay diorama of the real Horizon island inside a clock bezel of 31 day slots,
with a Year ring of minis and a Week Party Board trail along the real Year Walk — one level pull (Year · Month · Week).
Money stands on the map as toys on coin stacks; every word is DOM; the list carries the same stops and the same actions.

**Journey = understand, budget, plan, act. Horizon = explore, play, inhabit.** Same world, same coordinates, two jobs.

Decisions: `docs/DECISIONS.md` D49–D67 (the Journey Board) and D68–D74 (the Horizon Clock). Handoff and plan of record:
`docs/CLAUDE_JOURNEY_CLOCK.md`. Shared types: `contracts.ts` — change them only through the integrator.

## Layers and owners (one writer per folder)

| Folder | Lane | What it is | May import |
|---|---|---|---|
| `contracts.ts` | integrator | shared types, id builders, `LEVEL_T` / `STACK_RULER` / `JOURNEY_DIORAMA`, `isToCheck` / `ringsFor` / `toDiorama` / `fromDiorama`, the action dispatcher | types only (+ tiny pure helpers) |
| `model/` | L1 | PURE `deriveJourneyBoard(h, memberId, today)` → `JourneyBoard` (stops, chapters, `week`, `year`, `toCheck`, `purse`, `digest`); `listView(h, board, scope)`; `boardToList`; every status word and money sign (`words.ts`: `MAP_WORDS`, `signedMoney`, `rulerWords`, `chapterStatusText`, `openPlaceWords`) | `src/core/*` selectors, `src/harbour/glass/{dayLedger,campCardModel}.ts`, `src/campfire/model.ts`, `src/home/{progression,model,site,catalogue}.ts`, `src/hearthside/{contracts,winMemory}.ts` — no React, no three, no storage |
| `land/` | L2 | `loadJourneyLand()` (the only `fetch`), pure extraction, `dioramaFrame(land)` from the coastline, `buildJourneyLand()` clay island (lights, Week calm, Year mini geometry), `JourneyLandFlat` SVG twin, the three clay palettes | `three`, `src/house/world/horizonAssets.ts` (parse + URLs), `src/harbour/horizon/land/terrain/asset.ts`, `src/home/{geometry,site}.ts` |
| `board/` | L3 | pure `layoutClock` / `layoutWeek` / `layoutYear` / `stackFor`, `levels.ts` (the pull, the chapter turn), `createJourneyMapScene()` on the shared renderer lease (bezel, toys on stacks, the cat-eared bus, Hercules, minis, trail), `BoardFlat` for all three levels, `mapLabels` / `placeLabels` (max 3) | `three`, `src/house/world/rendererOwner.ts`, `land/` |
| `ui/` | L4 | React: `JourneyBoard.tsx` (entry), header, purse chip, stage + DOM marks, Hercules's bubble + checklist, stop / day / chapter / crossroads sheets, "Which one?", "+" dial, level pull + Key, `ListView`, `viewState.ts` (the only storage), CSS for three themes | `model/`, `land/`, `board/`, `src/theme/*`, read-only: `src/harbour/flag.ts` (`HORIZON_AVAILABLE`), `src/harbour/scene/quality.ts` (tier), `src/worldGeography.ts` (revision), `src/harbour/nav/motionKey.ts` (the edition key, constants only — never `motionEdition.ts`, which holds the storage writer), `src/diagnostics/inspectorCore.ts` (the local Inspector: no network; a report leaves only when the person copies or saves it) |

## Rules (fenced by `test/journey-board-fence.test.ts` and `test/journey-map-geometry-source.test.ts`)

1. No import of `core/index`, `core/commands`, `kitchenCommand`, `ledger/`, `ledgerSync/`, `storage`, `continuity`,
   `api`, `supabase`, any name exported as `captureCommand(…)`, any App-level writer (`ChapterPanel`, `PlanStudio`,
   `Books`, `AddSlideshow`, `campfire/beats|CampfireRitual|WeeklySitdown|useCampfireWrite`, …), `src/path/**`, or the
   Horizon runtime (`src/harbour/horizon/runtime/**`, movers, weather).
2. `fetch` only in `land/load.ts`; `localStorage` only in `ui/viewState.ts`; no `import.meta.env` anywhere here.
3. Every way out is a `JourneyBoardActions` callback (`runJourneyAction`). Selecting, pulling the level, turning the
   chapter, previewing, animating or arriving never posts money, marks a bill paid, completes a task, closes a Chapter
   or grants a milestone. The dial's "All tools" and "Simple view" open the quick sheet / pick the display edition only.
4. Expected ≠ confirmed; due date passing ≠ paid; set aside ≠ paid; fully backed ≠ bought; a done task ≠ a memory.
   On the map: a null amount draws NO stack ("Unknown amount"); recorded stacks are solid, everything else see-through,
   and the two are never summed; Fund contributions are their own figure ("To the Fund"), never in "In"; "to check" is
   ONE definition (`isToCheck`: a commitment that is overdue or needs review — the old attention list's rule, so a
   needs-review bill today or later counts too); every attention item lands in exactly one checklist section (To
   check, This week, Waiting on you, Chapter); stacks cap at 30 rings with a break and the amount is always printed.
   Expected pay reads "expected today · not recorded on its schedule" (never "not in yet"); when a pay is already
   recorded the same day the purse, the stop's sheet and its list row print the model's note ("A pay is already recorded
   today · check the Books before recording this one") and both stops stay (no de-duplication). The dial's record verbs
   are the App's own (`recordModes`, its `fabActionsFor` list). All status words and money signs (`signedMoney`, the
   sign from the value) come from `model/words.ts`; `ui/copy.ts` holds layout words only, never a status or money word.
5. Stable ids from source ids (`journeyIds`). Derive on read; nothing about the map is stored except view state
   (`hearth:journey-board:v2:…`; a v1 record is migrated once).
6. Three authored themes (classic / taylor / newfoundland, with Newfoundland's clapboard plinth); the theme dot applies
   the app-wide theme; reduced motion (`prefers-reduced-motion` or `html[data-motion="reduced"]`) makes every movement
   a cut; touch targets ≥ 44 px; the list carries the same stops and the same actions; the canvas is `aria-hidden`.
7. Lightweight: the slim baked land (index + the `journey` terrain LOD) only — never district chunks, movers, weather.
   Real shadows on the full tier, blob shadows on lite. Flat tier / no WebGL / a failed load → the flat clock (SVG) +
   the list; budgeting never waits for the 3D scene.
8. **Horizon → Journey.** The map is drawn from the bake only: every coast, landform, water body, district, road,
   station and Year Walk stretch comes from `JourneyLandData`; the diorama frame comes from the coastline
   (`dioramaFrame`), never constants; no hand-authored coordinate arrays or centre/radius literals in `land/` or
   `board/`. Any big structural change to Horizon must be reflected here: re-bake, keep `pnpm horizon:check` green, and
   attach Journey map captures to the Horizon PR (Jonathan, 2026-10-05; AGENTS.md Mission; D74).
