# The Journey map: Horizon Clock — handoff and plan of record (2026-10-05)

**Status:** local branch `claude/journey-clock` from `main@9d13db2` (#585), fix pass merged. Not pushed, no PR, not
merged, not deployed, not live verified. Evidence in `docs/evidence/journey-map/` predates the fix pass (re-capture owed).
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

## Fix pass (2026-10-05, after the evidence pass)

Rulings in the orchestrator's FIXES list; two lanes merged on this branch (`claude/jc-fixa` f539d0b, `claude/jc-fixb`
1f8d071), then the integrator removed the lane-B shim (`ui/mergeShim.ts`) and switched the ui to lane A's real names.

- **Trust M1 (D69 amended):** `isToCheck` = a commitment that is overdue or needs review, on any date (the old attention
  list's own rule; a needs-review bill today or later is no longer dropped). Every attention item lands in exactly one
  checklist section; chip, bubble, Week pile, Year counts, list "Needs you" and the checklist agree (tests).
- **Trust M2:** waiting-on-you and the repeating reminders show on the bubble, as list groups with labelled buttons, and
  as a count chip in the header at Year and in List — the bubble never says "0 to check" while something waits.
- **Trust M3:** expected pay reads "expected today · not recorded on its schedule". When a confirmed pay already stands on
  the same day, `PurseExpected.note` / `ListRow.note` ("A pay is already recorded today · check the Books before
  recording this one") print in the purse, on the stop's card and on its list row. No de-duplication.
- **Trust M4:** `JourneyBoardProps.recordModes` (`JourneyRecordMode`, the App's `fabActionsFor` list): the dial gets
  "Record a shift…" for a member with a job and "Move money…" (transfer), exactly as the App's own dial.
- **Trust minors:** the dial's Enter Horizon is `ActionCall {name: "enterHorizonCentre"}`, resolved by
  `runJourneyAction(…, {centre})` (no placeholder location); money signs from the value (`signedMoney`); chapter needs
  in separate words ("5 to check · Chapter close due"); all status words moved to `model/words.ts` (Key, legend,
  reminders, checklist title, ruler words, chapter status, "Open the {place}") and the ui duplicates deleted; `MOTION_KEY`
  from the constants-only `harbour/nav/motionKey.ts` (fence allowlist per layer); the local Inspector has no network
  egress (test); v2 view state written right after a v1 migration.
- **UX:** Week at rest has one callout (Today) and day tags printed on the tiles; Year plates on every mini (to-check
  count; recorded / not recorded apart), the open month outlined, a persistent caption ("Each stack = bills on the map
  that month · ring = $1,000 · not all spending"); "Setting aside next · Winter reserve" for a jar
  (`Digest.nextIsSettingAside`); the bus folds into today's mark (axe target-size 0); day marks size 24–44 px to their
  spacing; slider arrow keys step a level; popovers close on outside press / selection / level; flat Key text; one
  live region; theme details in the shell (Classic hearth-tile edge, Taylor washi tape, Newfoundland clapboard).
- **A9 (phones):** on arrival the board's full-height slot is scrolled to the top so the clock is full size; the App
  header and banners are untouched.

## Final review pass (2026-10-05, on `99e1396`)

Commits `55ac0ed` (items 1–7), `035f9a7` (items 8–12) and the evidence/docs commit after them.

- **Geometry-source proof (MAJOR 1).** `test/journey-map-geometry-source.test.ts` now proves what it claims:
  - moving the land 50 m east moves the frame, the clock slots, the clay shallows and slab, and the flat twin's coast,
    stations and hosts by 50 m (bounding boxes, not just "a new array");
  - the terrain mesh moves by −50·scale;
  - every `data-x` in `BoardFlat` moves by +50 at Year, Month and Week (`data-y` by 0).

  The coordinate scan flags runs of ≥4 pairs, flat runs of ≥8 numbers, and ≥4 `{x, y}` literals. It has a two-entry
  allowlist (`land/clay.ts` tree-pot lathe, `board/scene.ts` Hercules offsets), and a self-test keeps both entries
  honest. **Proof it fails:** a temporary `export const HAND_COAST = [[900, 180], [1075.6, 176.7], [1200, 190],
  [1261.6, 208.4]];` in `board/clock.ts` failed the test with that exact offence (1 failed | 6 passed). It was then
  removed (diff clean).
- **CI (2):** `horizon-assets.yml` runs the geometry-source test, and both path lists include `src/journey/board/**` and
  the test.
- **Flat Key (3):** the mounted flat map (`ui/Stage`) draws DOM discs and no stacks. `BoardFlat`'s bars are the scene
  twin's, not what the person sees. So the copy stays true as "No stacks in this view: one disc per day …", and the ui
  test pins it with `.journey-stage [data-stack]` = none.
- **Break mark (4):**
  - `BoardFlat` gives a stop over $3,000 a `[data-capped]` path;
  - the 3D `coinStack` adds exactly the two break-mark meshes when `rings.capped`;
  - `BoardFlat` uses `MIN_STACK_DU` (5).
- **Fence (6):** `importsOf` also reads side-effect imports. `sendBeacon`, `XMLHttpRequest`, `WebSocket` and `EventSource`
  are banned across `src/journey` alongside `fetch`.
- **Enter Horizon (7):** with no centre, `enterHorizonCentre` makes no `enterHorizon` call (test).
- **44 px marks (8):** every day mark has a 44 px hit area at every width (64 for the live chapter). A crowded disc draws
  smaller inside it (`--glyph-scale`). Overlapping hits ask "Which one?" on live and flat maps alike.
- **Phone purse (9):** under 720 px it is two lines plus "›". The tap opens "The purse · today", a sheet with the model's
  full expected / already-recorded words. Wide is unchanged.
- **Year under 360 px (10):** one-line plates ("Sep · 5"), with figures only on the open month.
- **Real-App framing (11, 12):**
  - the board frame starts below the floating Mountain/Horizon toggle (its bottom + 4 px). The toggle does not move.
  - arrival scrolls the board region to the top on every width, so the wide clock is full size (about 550 px across,
    was about 210).
  - **Broadened:** that wide scroll put the App's floating wide Hercules (`.hercules-live`) over the board's "i". It now
    rests while the board stands (`src/styles.css`, the Court's own rule; the board's scene draws Hercules). A CSS
    contract test pins it.
- **Evidence:** re-captured the 320/390 matrix in all three themes, `which-one-390-taylor` (a real press on two
  overlapping 44 px hits) and both real-App arrivals. The README findings are updated. The capture script now presses
  overlapping DOM hits for Which-one and records `toggleClear` in `real-app.json`.

## Verification (local, final review pass, `035f9a7` + Hercules rule)

- `pnpm typecheck`: clean. `pnpm build`: exit 0; `JourneyBoard` 254.56 kB (88.33 kB gzip) + 38.47 kB CSS.
- Gate (`--risk=medium-high`, the six focus files) on the final tree: 54 fast files selected (the `styles.css` change
  pulls in more). The fast phase was **619 / 620** in 102 s; the whole run took 3 min 39 s.
  - The one failure is `test/swipe.test.ts › nets refund and income reversals`. It fails identically on `origin/main`
    (checked in a clean worktree), so this branch did not cause it.
  - The gate stops after the fast phase, so the serial phase was run alone: `app-startup-p1` **83 / 83** (the Bianca
    regression).
- The same gate on `035f9a7`, before the Hercules rule, ran fast **564 / 564** and serial `app-startup-p1` 83 / 83. It
  took 6 min 53 s, `time-budget-breached` in the serial browser files: the known browser failures below, plus missing
  `chromium_headless_shell-1234`.
- The Hercules rule's CSS contract test passes alone and in the fast phase.

## Verification (local, this branch, after the fix pass)

- `pnpm typecheck`: clean. `pnpm build` (bake `--check`s): green; `JourneyBoard` 252.6 kB (87.9 kB gzip) + 37.8 kB CSS.
- Gate (`--risk=medium-high`, focus: journey-board-app, -fence, -map-geometry-source, app-startup-p1, journey-map-board,
  journey-board-ui, -parity, journey-land, journey-map-model, journey-board-model): 59 selected (51 fast, 8 serial).
  Fast phase **555 / 555** in 109 s. Serial: `app-startup-p1` **83 / 83** (the Bianca regression), `plan-system`,
  `proof-matrix`, `hearthside-workspace-browser` green; the four known failures only — `hearthside-actual-app-browser`
  and `-v2-browser` fail identically on `main@9d13db2` ("The first-plan proposal changed…" / a click timeout), and
  `hearthside-bank-ack-recovery` and `workspace-merge-review-browser` need the missing `chromium_headless_shell-1234`.
  Whole gate 6 min 55 s: `time-budget-breached` in the serial phase (those browser files), not in the journey tests.
- Timing tests under parallel load (`journey-land › slim parse`, the model's < 400 ms): green in this run; both have
  timed out under load before and pass alone. Not loosened.
- Known pre-existing on main, not touched: `test/journey-mini-story.test.ts` (a seed hits the Fund top-up rule).
- Data: fictional Development demo, jsdom.
- **Evidence is stale for the fix pass:** `docs/evidence/journey-map/` was captured at `8009001`, before the fixes (it
  still shows "not in yet", the old Week and Year). B10's re-capture did not run; it is the next step.

## Still to do (next owners)

1. **Evidence not re-captured** (the final pass re-captured 320/390, Which-one 390 and the real App only):
   - the 720/1100 matrix, which still shows `9cbd510` marks under 44 px;
   - axe;
   - keyboard, sheets, list and failure states;
   - Year 320×568, where the bottom of the ring (Jul, half of Aug/Jun) sits under the level pull.
2. **Phone performance** on a real device (12 minis, 31 props, shadows): the lite tier and the budget test are in place.
3. **Jonathan's decisions:**
   - **A9 App chrome:** the App header and the status banners still stand above the map on every width. Arrival now
     scrolls the map to full size, so the Development label is a scroll away. Should the Journey route hide or collapse
     the App header / banners on phones (ruling 11 left them as is)?
   - D68–D73 (proposed; D69 amended for trust M1), and whether the dial's Simple view should stay a one-way exit (D65
     lands on the Court).
   - Whether the floating wide Hercules should rest on the Journey route (done here, as on the Court) or move aside.
4. **Pre-existing on main:** `test/swipe.test.ts › nets refund and income reversals` fails on `origin/main`.

No money-meaning question was opened: every figure on the map is an existing selector's or a source record's, and every
write still goes through its own named Confirm.
