# The Journey map: Horizon Clock — handoff and plan of record (2026-10-05)

**Status:** local branch `claude/journey-clock` from `main@9d13db2` (#585). Not pushed, no PR, not merged, not deployed,
not live verified. Evidence captures are not made yet (a separate pass owns them; see "Still to do").
**Risk:** **Medium-High** (replaces the household Journey presentation and the illustrated edition's arrival surface;
hides the Compass over it; wires three App callbacks). No money arithmetic, command, schema, sync, Auth/RLS, Worker or
Hercules payload change.
**Budget (5): +1.** The home screen's money words are stricter: one "to check" definition, Fund never in "In",
expected pay never added to Everyday, unknown amounts drawn as no stack, recorded and not-recorded never summed.
**Engagement (3): +2.** A clay toy island inside a clock: toys on coin stacks, the cat-eared bus on today, Hercules on The
Green, a Year ring and a Week Party Board trail on the real Year Walk; one pull between them.
**Decisions:** `docs/DECISIONS.md` D68–D74 (D74 decided by Jonathan; the others proposed, conservative defaults).
**Supersedes:** the status of [`CLAUDE_JOURNEY_BOARD.md`](CLAUDE_JOURNEY_BOARD.md) (D51, D55, D63 superseded; D52 revisited). That
file stays as the record of the route board.
**Module rules:** [`src/journey/README.md`](../src/journey/README.md).

## What changed

The household Journey surface (`{room: "kitchen-table", level: "above", surface: "journey"}`) is now the **Horizon
Clock**, built from the approved prototype (`horizon-clock.html`, plan of record and orchestrator rulings 1–13):

- **Month** (the arrival): the baked island as a clay diorama inside a plinth and a bezel road of 31 day slots (day 1 at
  north). Each stop is a toy on a coin stack (`ringsFor`: a ring every $100; solid = recorded, see-through = not; a null
  amount draws no stack; capped at 30 rings with a break, the amount always printed). A honey "!" ring marks a day
  holding a "to check" stop. The cat-eared bus stands on today; Hercules sits on The Green.
- **Year**: a ring of minis (one per chapter in the window), each with its Year stack ($1,000 a ring; recorded and open
  side by side; commitments and non-Fund income only — "bills and planned costs on the map, not all spending").
- **Week**: Monday–Sunday Party Board tiles on a paper trail along the real Year Walk; today's tile biggest, empty days
  stepping stones; earlier "to check" stops pinned as one pile on Monday ("pinned is not paid"). The land calms away from
  the trail.
- **Chrome**: header (i "About this map" with the bake revision and the limitations · ‹ month › · theme dot), purse
  chip (Everyday and today's expected pay printed apart), Hercules's bubble → his checklist (To check · This week ·
  Waiting on you · Chapter · Repeating reminders), stop / day / chapter / crossroads sheets ("Which one?" for several),
  the "+" dial (Record a purchase… · Mark paid… · Record income…; Open: Calendar · Books · Kitchen table · Simple view ·
  All tools · Enter Horizon), the level pull + Key, Map/List. The list (`listView`) carries the same stops and the same
  `actions[]`, "Needs you" first, with a strip: In / Out in the Books, To the Fund, Still to come (estimates apart,
  unknowns counted), Needs you.

Every word is DOM (`model/words.ts`); the canvas is `aria-hidden`; every mark is a 44 px button; reduced motion cuts.
Flat tier / no WebGL / a failed land → the flat clock (SVG) and the list.

## Where actions connect (unchanged paths, three new App callbacks)

Every way out is `runJourneyAction` over `JourneyBoardActions` (`src/App.tsx`, `journeyActions`): Mark paid… →
`openRecordFlow("bill", …, recurrenceId)` (its named Confirm); expected pay → `openDueReviewFromBoard` (the reviewed
recurrence path); Calendar / Books / Kitty / Era planner / Campfire / HomeBook / Enter Horizon as before. New:

| Callback | App wiring | Writes? |
|---|---|---|
| `openAllTools` (dial chip) | `setQuickSheetOpen(true)` — the Compass's own quick sheet | No |
| `chooseSimpleView` (dial chip) | `chooseMotionEdition("flat")` — the one shared writer; the App's edition effect then lands on the Court (D65) | Device display preference only |
| `JourneyBoardProps.onChooseTheme` (theme dot) | `appearance.store.apply(theme)` — app-wide, as the appearance picker (ruling 12) | Appearance only |

The Compass is not drawn while `journeyBoardShown` (the map has its own "+").

## Integration notes (what the integrator changed beyond the lanes)

- **Week calm** is one contract method, `JourneyLandHandle.setCalm(calm | null, amount)` with `JourneyLandCalm {trail,
  clear}`; the scene builds one request per Week layout (trail + tile / pile discs) and pushes the amount at most every
  90 ms while the pull moves (rests always pushed) — the land recomputes its field ~35 ms on full.
- **One frame**: `board/geo.frameFromCoast` and the UI's flat frame now call L2's `dioramaFrame` (the coast's enclosing
  circle); the board's bounding-box variant is gone. One board test tolerance moved from > 20 m to > 10 m accordingly
  (a 36 m walk shift moves Monday ≈ 17 m with the enclosing-circle frame).
- **Palettes / lights**: the board reads L2's `JOURNEY_CLAY_PALETTES` / `JOURNEY_PROP_PALETTE` / `CLAPBOARD` (its copy is
  deleted); the scene adds L2's `createClayLights(theme, tier).group` (shadow map on full).
- **Deleted**: the route board (`board/` routeScene, routeFlat, route, crossings, marks, dressing, camera, ribbon,
  layers, preview, spaces, signposts, shapes, materials, piece, pavilion, shadows; `labelRankFor`), the route land
  (`land/` build, terrain, water, hosts, airport, lines, bridges, dressing, `planRoad`), `ui/JourneyList.tsx`,
  `test/journey-board-route.test.ts`, and the deprecated contracts. `JourneyBoard` IS the v2 board; `ActionCall` gains
  `openAllTools` / `chooseSimpleView` (the fence pins them). The model's summary is internal
  (`deriveJourneyBoardWithSummary` for tests proving nothing it saw is lost from `purse` / `digest` / `toCheck`).
- **Horizon → Journey (D74)**: AGENTS.md Mission line, README rule 8, `src/journey/land/**` in both path lists of
  `.github/workflows/horizon-assets.yml`, a focus-map entry (land files → `horizonBakeArtifacts` + land / road /
  geometry-source tests), and `test/journey-map-geometry-source.test.ts`.
- **Pre-existing failure fixed in its own commit**: `test/harbour-source-fences.test.ts` did not list
  `src/harbour/geometry` (added by #585, a pure helper with no imports). That fence also now reads the conditional
  Compass.

## Verification (local, this branch)

- `pnpm typecheck`: clean.
- Gate: `pnpm test -- --risk=medium-high --focus=test/journey-board-app.test.ts --focus=test/journey-board-fence.test.ts
  --focus=test/journey-map-geometry-source.test.ts --focus=test/app-startup-p1.test.ts --focus=test/journey-map-board.test.ts
  --focus=test/journey-board-ui.test.ts --focus=test/journey-land.test.ts --focus=test/journey-map-model.test.ts
  --focus-reason="…"`: 59 selected (51 fast, 8 serial). Fast phase **522 / 523** in ~100 s (whole gate ~4 min, no
  time-budget breach); the one failure is the known timing test `journey-land › measures the slim parse…`, which times out at 15 s
  only under the gate's parallel load and passes alone (~6 s). Not loosened. One earlier gate run had it green.
- Serial phase, run by hand exactly as the gate would (`--maxWorkers=1 --testTimeout=30000`): `app-startup-p1` **83 / 83**
  (the Bianca regression), `plan-system`, `proof-matrix`, `hearthside-workspace-browser` green; `hearthside-actual-app-browser`
  and `-v2-browser` fail identically on clean `main@9d13db2` ("The first-plan proposal changed…"); `hearthside-bank-ack-recovery`
  and `workspace-merge-review-browser` skip / fail for the missing `chromium_headless_shell-1234` binary. All four predate
  this branch.
- `pnpm build` (runs the bake `--check`s): green; `JourneyBoard` chunk 235.5 kB (82.7 kB gzip) + 29.9 kB CSS.
- Known pre-existing on main, not touched: `test/journey-mini-story.test.ts` (a seed hits the Fund top-up rule).
- Data: fictional Development demo (`seedDemoHousehold`, `journeyDemoHousehold`), jsdom only; no phone, no browser
  capture yet.

## Still to do (next owners)

1. **Evidence captures** (separate agent): `scripts/serve-journey-map-proof.mjs` (modelled on
   `serve-journey-mini-proof.mjs`), 320 / 390 / 720 / 1100 × 3 themes × Year / Month / Week, list, reduced motion,
   keyboard, empty / loading / error / offline, flat, axe at 390 / 1100 → `docs/evidence/journey-map/`.
2. **Phone performance** on a real device (12 minis, 31 props, shadows): the lite tier and the budget test are in place.
3. **App chrome above the board** (status banners, Our Home / My Money tabs) is left as is (ruling 11), a follow-up.
4. **Jonathan**: D68–D73 (proposed), and whether the dial's Simple view should stay a one-way exit (D65 lands on the Court).

No money-meaning question was opened: every figure on the map is an existing selector's or a source record's, and every
write still goes through its own named Confirm.
