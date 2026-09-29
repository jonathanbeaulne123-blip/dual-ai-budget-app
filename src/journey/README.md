# src/journey — the Journey Board

The household Journey surface (route `{room:"kitchen-table", level:"above", surface:"journey"}`, view household) and
the app's arrival home: a Game-of-Life-style board (route, spaces, household piece, crossroads, chapters, milestones)
drawn as a presentation layer over a low-poly, bird's-eye rendering of the real Horizon island.

**Journey = understand, budget, plan, act. Horizon = explore, play, inhabit.** Same world, same coordinates, two jobs.

Decisions: `docs/DECISIONS.md` D49–D67 (the Journey Board). Handoff and plan of record: `docs/CLAUDE_JOURNEY_BOARD.md`.
Frozen types: `contracts.ts` — change them only through the integrator.

## Layers and owners (one writer per folder)

| Folder | Track | What it is | May import |
|---|---|---|---|
| `contracts.ts` | planner → integrator | shared types, id builders, camera/height/LOD constants, the action dispatcher | types only (+ tiny pure helpers) |
| `model/` | T1 | PURE `deriveJourneyBoard(h, memberId, today)` → `JourneyBoard`; `boardToList(board)` → `ListRow[]` | `src/core/*` selectors, `src/harbour/glass/{dayLedger,campCardModel}.ts`, `src/campfire/model.ts`, `src/home/{progression,model,site}.ts`, `src/hearthside/contracts.ts` — no React, no three, no storage |
| `land/` | T2 | `loadJourneyLand()` (the only `fetch`), pure extraction, `buildJourneyLand()` three.js land, `JourneyLandFlat` SVG twin, land dressings | `three`, `src/house/world/horizonAssets.ts` (parse + URLs), `src/harbour/horizon/land/terrain/asset.ts`, `src/home/{geometry,site}.ts` |
| `board/` | T3 | `layoutRoute(board, land)` (pure), `createJourneyBoardScene()` on the shared renderer lease, piece, spaces, signposts, camera tiers, `placeLabels()` (pure), board dressings, SVG route overlay | `three`, `src/house/world/rendererOwner.ts`, `land/` public API |
| `ui/` | T4 | React: `JourneyBoard.tsx` (entry), stage + DOM marks, `StopPanel`, `CrossroadsPanel`, `JourneyList`, `ChapterStrip`, `BoardSummary`, piece look picker, `viewState.ts` (the only storage), CSS for three themes | `model/`, `land/`, `board/` public APIs, `src/theme/*` |

## Rules (fenced by `test/journey-board-fence.test.ts`)

1. No import of `core/index`, `core/commands`, `kitchenCommand`, `ledger/`, `ledgerSync/`, `storage`, `continuity`,
   `api`, `supabase`, any name exported as `captureCommand(…)`, any App-level writer (`ChapterPanel`, `PlanStudio`,
   `Books`, `AddSlideshow`, `campfire/beats|CampfireRitual|WeeklySitdown|useCampfireWrite`, …), `src/path/**`, or the
   Horizon runtime (`src/harbour/horizon/runtime/**`, movers, weather).
2. `fetch` only in `land/load.ts`; `localStorage` only in `ui/viewState.ts`; no `import.meta.env` anywhere here.
3. Every way out is a `JourneyBoardActions` callback (`runJourneyAction`). Selecting, zooming, previewing, animating
   or arriving never posts money, marks a bill paid, completes a task, closes a Chapter or grants a milestone.
4. Expected ≠ confirmed; due date passing ≠ paid; set aside ≠ paid; fully backed ≠ bought; a done task ≠ a memory.
5. Stable ids from source ids (`journeyIds`). Derive on read; nothing about the board is stored except view state.
6. Three authored themes (classic / taylor / newfoundland); reduced motion (`prefers-reduced-motion` or
   `html[data-motion="reduced"]`) makes every movement a cut; touch targets ≥ 44 px; the list carries the same stops
   and the same actions; the canvas is `aria-hidden`.
7. Lightweight: the index + the `journey` terrain LOD only (never district chunks, movers, weather). Flat tier / no
   WebGL / a failed load → SVG land + the list; budgeting never waits for the 3D scene.
