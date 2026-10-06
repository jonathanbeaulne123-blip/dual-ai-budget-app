# The Journey Board — handoff and plan of record (2026-09-28)

> **Superseded (2026-10-05):** the Journey map is now the Horizon Clock — see [`CLAUDE_JOURNEY_CLOCK.md`](CLAUDE_JOURNEY_CLOCK.md) and D68–D74. This file stays as the record of the route board (D49–D67).

**Status:** branch `claude/journey-board` from `main@9fed600` (#564). Pushed; [PR #567](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/567) to `main`. Not merged, not deployed, not live verified.
**Risk:** **Medium-High**. **Budget (5): +1.** **Engagement (3): +2.**
**Decisions:** `docs/DECISIONS.md` D49–D67, all PROPOSED and waiting for Jonathan (summarised at the end of this file).
**Evidence:** [`docs/evidence/journey-board/INDEX.md`](evidence/journey-board/INDEX.md).
**Module rules:** [`src/journey/README.md`](../src/journey/README.md).

## What changed, in one paragraph

The household Journey surface (route `{room: "kitchen-table", level: "above", surface: "journey"}`, household view) is
now **the Journey Board**: a Game-of-Life-style board — a route, spaces on it, the household's piece, crossroads,
chapters and milestones — drawn as a presentation layer over a low-poly, bird's-eye rendering of the real baked
Horizon island. It replaces the household-grown spiral (`OurPathWorld`) on that route; `OurPathWorld` stays in the tree
and personal scope is unchanged. It is the illustrated edition's arrival home (D49 / D65: the reading edition still
arrives at the Court, where the Desk opens). Everything on the board is derived on read from the household snapshot,
the member and the App's `today`. There is no schema change, no new synced collection, no new command kind, and nothing
on the board posts money.

**Journey = understand, budget, plan, act. Horizon = explore, play, inhabit.** Same island, same coordinates.

## How the board works

### Three layers (one owner per folder, fenced)

| Layer | Folder | What it is |
|---|---|---|
| Model | `src/journey/model/` | PURE `deriveJourneyBoard(household, memberId, today)` → `JourneyBoard` (chapters, stops, clusters, crossroads, piece anchor, traces, summary) and `boardToList(board)` → the list rows. Reads existing selectors only (`calendarWeight`, `dayLedger`, `campCardModel`, chapters, goals, tasks, `pathEras`, `planSystem`, home progression, hearthside memories, wins). No React, no three, no storage. |
| Land | `src/journey/land/` | `loadJourneyLand()` — the board's only `fetch` — reads the slim baked artefact `public/horizon/world/horizon-geo-1.journey.json.gz` (≈ 21 KB gzip; written by `scripts/horizon/bake-terrain.mjs` from the same index and terrain, held by its `--check`), falling back to the full Horizon index + the `journey` terrain LOD when the slim file is missing or stale. `buildJourneyLand()` draws coast, shallows, height bands, roads (minor roads hidden at Sky), hosts as blocks with landmarks, reserves and the member homes at map scale. `JourneyLandFlat` is the SVG twin from the same data. No MANIFEST, terrain, road, building or mover change. |
| Board | `src/journey/board/` | `layoutRoute(board, land)` (pure) and `createJourneyBoardScene()` on the shared renderer lease: the route ribbon, month and day spaces, signposts, the piece, selection ring, milestone pavilions, crossroads preview, near-orthographic camera tiers, collision-aware DOM label placement. `BoardFlat` is the SVG overlay for the flat tier. |
| Chrome | `src/journey/ui/` | React: `JourneyBoard.tsx` (entry, lazily loaded by the App), the stage with real-button marks, `BoardSummary`, `ChapterStrip`, `StopPanel` / cluster / chapter panels, `CrossroadsPanel`, `JourneyList`, the piece-look picker, `viewState.ts` (the module's only storage), `journey-board.css` for the three themes. |

The canvas is `aria-hidden`; every mark is a real `<button>` in the DOM, positioned per frame from `anchors()`. Fence:
`test/journey-board-fence.test.ts` (no commands, kitchen, ledger, storage, continuity, api, supabase, `src/path`, Horizon
runtime, movers or weather; `fetch` only in `land/load.ts`; `localStorage` only in `ui/viewState.ts`; no
`import.meta.env`; no second clock).

### The route and the twelve stations

A chapter is a calendar month, and each month stands on one of the twelve baked Year Walk station anchors. The route is
a presentation ribbon through those stations in calendar order (D51) — not the carved 5.2 m bed. Calendar order makes
it cross itself; the crossings are drawn over/under and no day space sits near one (D55). Over water the ribbon becomes
a boardwalk. The board shows about a year: eight months back, this month, three ahead (D58); older months live in the
list and the Books.

Camera tiers: **Sky** (the whole island, ≤ 8 posts: crossroads, attention, the next three, milestones), **Region** (a
stretch of months, day spaces appear) and **Stop** (one stretch, day spaces and "Enter Horizon here"). North-up and
gently angled for reading (D63).

### Stops, by kind, with their status words

Stop ids are stable and come from source ids (`bill:<recurrenceId>@<date>`, `income:<source>@<date>`,
`review:<chapterId>`, `plan:<taskId|goalId>`, `milestone:<memberId>/<awardId>`, `memory:<memoryId>`), so a selection
survives an import or a correction. Same-date stops cluster into one mark ("4 on Mon 28 Sep").

| Kind | Statuses | Honesty rule |
|---|---|---|
| Commitment (bills, visits) | upcoming · due today · overdue · paid · needs review; plus "set aside in Prepare/Build" | A due date passing is **overdue, never paid**. Paid needs a recognised posting. Set aside is not paid. Two postings for one occurrence read "Paid · 2 postings · review in the Books", never a summed figure (D67). |
| Income | expected (schedule, payday, Fund estimate) · confirmed (recorded, Fund contribution) | **Expected ≠ confirmed.** A past expected stop reads "Expected · not recorded" and is not counted in attention (D60). |
| Review | Chapter close: upcoming · open · close due · waiting on you · waiting on partner · closed · no chapter. Weekly Sitdown: scheduled · session open | A skipped month is never a failure; a session existing is not a session finished. |
| Plan | Goal: backing · fully backed · bought (step 0–10). Task: open · done | Fully backed is not bought. |
| Milestone | granted · ready to record | Read from `homeProgress`; never granted here (D61). |
| Memory | kept by everyone | Only memories every member kept, plus Wins every member kept (D54). |

### The piece, crossroads, chapters and traces

- **The piece** stands on **today** (D56); a past month whose Chapter is still open shows "close due" and the piece
  carries a small hint. Its look (lantern, cat, boat, kettle) is saved on this device only (D52). "Back to now" (and
  `Home`) re-frames the piece and closes any panel.
- **Crossroads** are only real choices: era proposals (both agree, in the Era planner), the HomeBook's future blueprint
  per member, and a plan's `decision.nextStep` fork (display only). A crossroads panel previews — "Preview — nothing has
  changed" — explains the differences from the owning records, and either opens the owning surface or "Return without
  changing".
- **Chapters**: the chapter strip lists past / open / upcoming months with a NOW caption; a past chapter keeps small,
  sourced traces (chapter closed, books closed, plan reviewed, task done, memory kept, milestone). Browsing a past month
  moves the camera only — never the piece.

### Enter Horizon

"Enter Horizon here" appears at the Stop tier on the live scene (disabled over water) and in a place-tied stop panel;
never on the flat tier, and ordinary zooming never launches the world (D50). It calls `actions.enterHorizon(location)`,
which sets `enterHorizonRequest` under the clouds and navigates to the harbour; `HarbourWorld` mounts `HorizonWorld` with
that grounded body. Horizon's own **Journey** button returns to the board at the same framing. Picking a place in All
tools ends the visit (the Mountain again), and once Horizon has arrived a remount keeps the saved body (D67).

### List equivalent, summary, themes, motion, keyboard

- **Map / List** toggle: `JourneyList` has the same stops and the SAME actions as the map panels (both call
  `runJourneyAction`); status and amount words come from the same `boardToList` rows, so they never disagree
  (`test/journey-board-parity.test.ts`).
- **Summary** (calm header): where we are, Everyday · now, needs attention (the App's due reminders lead it, D66), coming
  next, do something now.
- **Themes:** Classic Hearth, Taylor's Scrapbook and Newfoundland each have authored land and board dressings
  (`JOURNEY_LAND_DRESSINGS`, `JOURNEY_BOARD_DRESSINGS`) and CSS (paper-tag labels, district tags, strip caption).
- **Reduced motion** (`prefers-reduced-motion` or `documentElement.dataset.motion === "reduced"`): cuts instead of the
  520 ms piece settle / 150 ms selection lift / 700 ms milestone settle; idle draws zero frames either way.
- **Flat tier** (no WebGL, a lost context, a build failure, or a flat quality tier): the SVG twin + the list; a failed
  land load keeps the summary and list with a quiet note. Budget actions never wait on the scene.
- **Keyboard:** summary → chapter strip → Map/List → Back to now → toolbar → marks → panel. On the stage: ←/→ a day (a
  month at Sky), Page Up/Down a month, Home back to now, +/− zoom, Enter opens what is on that day, Escape closes and
  returns focus to the opener. A polite live region announces moves. Touch targets ≥ 44 px.

## Where the real actions connect (`journeyActions` in `src/App.tsx`)

Every callback **opens** an existing surface; that surface keeps its own named Confirm. The board never posts, marks
paid, completes a task, closes a Chapter, grants a milestone or moves the household.

| Callback | Opens | Where the Confirm lives |
|---|---|---|
| `openRecord(mode, prefill)` | `openRecordFlow` → the Add sheet in that mode | Add's own Confirm |
| `openBillPaid(recurrenceId)` | `openRecordFlow("bill", …, recurrenceId)` → Bill paid at that bill's slide | Bill paid's named Confirm (`postBillPaid` re-reads `dueOccurrenceReview`) |
| `openDueReview(recurrenceId?)` | The App's due reminders (`DuePreviewSheet`) raised as a sheet above the board (`data-world-sheet`, z 20), focused on that occurrence; the board is `inert` behind it | Each row's named Confirm → `postOneRecurrence` (so the SAME income/bill stop turns confirmed/paid) |
| `openPlace(target, object)` | `openAtlasTarget` | The place's own tools |
| `openCampfire(chapterId)` | The Campfire sheet on the Chapter that is still open (it takes no month) | The Campfire ritual |
| `openWeeklySitdown()` | The weekly Sitdown | Its own steps |
| `openHomeBook(memberId)` | The viewer's own HomeBook (`JourneyHomeBookBridge`); a partner's id does nothing | HomeBook save (`acceptHome`) |
| `openEraPlanner(eraId)` | The `EraPlanner` sheet (modal: focus moves in, board inert, Escape returns focus) | Its both-agree buttons through `runKitchen` |
| `openKitty(goalId)` | `openHouseObject("loft-banks", "bank/goal:<id>")` | The Kitty Bank room |
| `openCalendar(date)` | `openHouseObject("calendar")` on its current month (D64) | Calendar tools |
| `openBooks(ref)` | Books month / register pane (`setBooksPaneRequest` + `goTab("ledger")`), or the Fund | The Books |
| `enterHorizon(location)` | Clouds → `setHorizonRequest` → harbour route → `HorizonWorld`; returns `false` while a passage is in flight and the board says so | — (no money) |
| `back()` | `putHouseObjectBack()` | — |

Other App-side edits: `src/harbour/nav/arrival.ts` (`JOURNEY_HOME_ROUTE`, edition-aware arrival), `JourneyBoardFrame`
(fixed overlay below `[data-app-page]`'s top; everything under it `inert`), the due-reminders count for the summary,
`src/harbour/HarbourWorld.tsx` / `src/harbour/horizon/HorizonWorld.tsx` (`enterHorizonRequest`, arrive once per seq),
`src/path/JourneyCloudTransition.tsx` (preloads the board), `src/AddSlideshow.tsx` (a paused sheet forgets its bill
preselection, so "Mark paid…" again lands on the Confirm again), `src/DuePreviewSheet.tsx` (`focusRecurrence`, focus
only), `src/core/toolAtlas.ts` (search synonyms), `scripts/horizon/bake-entry.ts` + `bake-terrain.mjs` (emit and check
the slim land), `test/verification-focus-map.json` (journey-board mapping).

## What was tested

All in this Linux sandbox (Node 22.22.2, pnpm 10.14.0), on the working tree before commit; base `9fed600`.

**TypeScript.** `pnpm typecheck` → exit 0 (≈ 1 m 50 s), after the integrator's reconciliation edits.

**Focused suites.** `pnpm vitest run test/journey-board-model.test.ts test/journey-board-route.test.ts
test/journey-board-ui.test.ts test/journey-land.test.ts test/journey-board-fence.test.ts test/journey-board-app.test.ts
test/journey-board-parity.test.ts test/journey-board-integration.test.ts test/harbour-arrival.test.ts
test/harbour-source-fences.test.ts test/journey-cloud-transition.test.ts test/desk-personal-app.test.ts
test/horizonBakeArtifacts.test.ts test/tool-atlas.test.ts --maxWorkers=2` → **14 files / 199 tests passed** (61 s).
Per file: model 33, route 22, ui 29, land 26, fence 7, App 11, parity 5, integration 14, harbour-arrival 17,
harbour-source-fences 9, journey-cloud-transition 2, desk-personal-app 4, horizonBakeArtifacts 7, tool-atlas 13.

**Merge of `main@0015a8a` (#565 DEV world toggle, #566 Mountain v2 on the Horizon) + PR review fixes (2026-09-28).** Both sides kept (the toggle's world-keyed shell and dam, the board's Horizon request and arrival); the slim land was re-baked from #566's index (Jan now at [1364, 650]; `horizon:check` clean). Fixes: Simple view on the board, or a restored Journey route in the reading edition, opens the Court/Desk; a kept Win stays until its adopted memory is kept by everyone; a posted visit keeps its stop id; crossroads past the Sky limit wait for a closer tier; Back to now closes the panel; the sample fixture follows the model (Sunday week start per `weekBounds`, contract comment corrected); one attention predicate; `openBooks` names each kind; HorizonWorld refs written in a layout effect.
`pnpm typecheck` exit 0; the 14 suites above minus `horizonBakeArtifacts` plus `app-startup-p1`, `month-rehearsal-mainline`, `harbour-world-toggle`, `harbour-one-bar`, `desk-personal`, `horizonMountainRegion`, `horizonGondola` → **20 files / 357 tests passed** (124 s, `--maxWorkers=2`); `horizonBakeArtifacts` + land/route/ui/model/parity 6 files / 122 passed after the re-bake. No new browser evidence; the screenshots predate the merge.

What the App-level tests (`test/journey-board-app.test.ts`, the real `App` with the real board on its flat twin) prove:
arrival lands on the board with the piece on today; a bill's "Mark paid…" (map and list) opens Bill paid at that
recurrence's named Confirm and closing returns the same selection and focus; select / zoom / preview / Back to now /
chapters / panels leave `financialAuditHash` unchanged and never move the piece; an empty household is honest; (B1) the
due reminders lead Needs attention, open above the board, and nothing under the frame is tabbable; (M1) "Review and
record…" on expected pay opens the due review on that occurrence and its Confirm turns the SAME stop confirmed with no
`income:tx` twin; (M3) Bill paid's Confirm turns the SAME bill id Paid with the selection kept; a tool opened from a stop
and "Put it back" returns to the same selection and control; the Era planner is a modal (focus in, board inert, Escape
returns focus); (M2) the arrival reads the slim land in one request, and without it the index path still stands the board.

**Quick gate.** `pnpm test -- --risk=medium-high --focus=test/journey-board-app.test.ts
--focus=test/journey-board-integration.test.ts --focus=test/journey-board-fence.test.ts --focus-reason="Journey Board: …"`
→ **`quick-gate-failed; time-budget-breached`** (760 s against the 300 s soft budget; breach in `vitest-serial`).
changed-files 131, fingerprint `4e49d6e0…d55028c`, working tree dirty (uncommitted), selected 99 (fast 89, serial 10).

| Phase | Result |
|---|---|
| diff-check | passed (0.0 s) |
| ai-surface | passed (0.6 s) |
| typescript | passed (102.0 s) |
| test-discovery | passed (17.7 s) |
| vitest-fast | **passed: 89 files / 1 094 tests** (131.0 s) — includes all eight `journey-board-*` / `journey-land` files and `test/month-rehearsal-mainline.test.ts` (D-183) |
| vitest-serial | **failed** (507.8 s): 6 files passed, 4 failed; 219 passed, 3 failed, 10 skipped. `test/app-startup-p1.test.ts` (the D-183 full-App Bianca regression) **83/83 passed** |

The serial failures, each followed up:
- `test/hearthside-actual-app-browser.test.ts` — 2 failed (books never reach `data-books-readiness="ready"`). Fails
  identically on a clean `git archive` of `9fed600` in this sandbox (the blind reviewer and the integrator both ran it):
  environmental, not this branch.
- `test/hearthside-bank-ack-recovery.test.ts` and `test/workspace-merge-review-browser.test.ts` — could not launch
  (Playwright wants `chromium_headless_shell-1234`, not installed here). Re-run through a local headless-shell shim
  (`PLAYWRIGHT_BROWSERS_PATH=<scratch>/pw`): bank-ack-recovery **6/6**; workspace-merge-review **3/4 on the first (cold)
  run** — "finishes its first StrictMode refresh…" failed at 5.3 s — then **4/4** on a rerun; `9fed600` 4/4.
- `test/hearthside-actual-app-v2-browser.test.ts` — 1 failed in the gate (Playwright timed out clicking the
  "Boathouse" room button) and again on the first standalone rerun; then **passed twice** (71.8 s, 70.2 s); `9fed600`
  passed once (72.1 s). A probe shows that single click blocks the page for ≈ 16 s on **both** trees in this sandbox
  (dev-mode Vite; 16.2 s here, 15.6 s on `9fed600`) against the test's 30 s action timeout, so it is timing-sensitive
  here; it was green on the earlier pre-fix gate run. Recorded as flaky-in-sandbox, not proven either way.

So this is **not** a green quick gate and is not "quick-gate verified"; it is the honest local record. Run it again where
Playwright's headless shell is installed and books reach ready.

**Performance (Node, unthrottled, this machine).** Slim land: gunzip + parse + decode **1.5 ms** (21.4 KB gzip) versus
index parse 85.1 ms + LOD decode 0.3 ms + extract 6.1 ms (1 869 KB fetched). `deriveJourneyBoard(demo)` warm median
**96.3 ms**. Land draw budget: full 10 423 tris / 10 draws; with the board, Sky ≈ 20 k tris / 20 draws, Region ≈ 37 k /
28. No phone measurement.

**Browser evidence.** [`docs/evidence/journey-board/INDEX.md`](evidence/journey-board/INDEX.md). Refreshed on the final
tree, a fresh page per real viewport (320×568, 390×844, 720×900, 1100×800): `arrival-classic-{320,390,720,1100}`,
`commitment-selected-{390,1100}`, `due-review-sheet-1100`, `income-review-panel-1100`, `income-review-1100`,
`list-view-390`. Every one of those page loads fetched only the slim land file. Kept from the earlier pass (before the
review fixes, labelled as such): BEFORE (`OurPathWorld` on `9fed600`), Taylor and Newfoundland arrivals at four widths,
cluster, past chapter, Back to now, the Enter Horizon → Horizon → Journey round trip, reduced motion, the keyboard
focus sequence, the flat twin (WebGL off) and the list at 1100.

**Accessibility.** axe-core (`@axe-core/playwright`, scoped to `[data-journey-board]`) on the final-tree arrival:
**0 violations at 390×844 and at 1100×800** (22 rules passed, 1 incomplete each). Keyboard, focus return, inert
coverage and the modal Era planner are asserted in the App tests above; the reduced-motion class and cut timings in
`test/journey-board-ui.test.ts` / `test/journey-board-route.test.ts`.

## Remaining limitations (honest)

- **Partner's home is not on this device.** Their customised home lives in their private space; the board shows only
  what this device holds (D57).
- **No household-shared exterior edits.** "Our home" is the fixed shared block; per-member modular homes follow the
  existing milestone → blueprint → HomeBook path (D53).
- **No household milestone engine.** Milestones are per member, read from `homeProgress` (D61); no dated "goal became
  fully backed" record exists, so that trace is not shown.
- **Season is always summer** on the board's land, while the Horizon follows the real season.
- **The yacht and fleet are not shown** on the board.
- **Calendar opens this month**, not the stop's date (D64).
- **Campfire opens the open Chapter**, not the month the stop belongs to.
- **Weekly Sitdowns only for this month**; past weeks are not shown as held or missed (D59).
- **A 1100×600 window scrolls the summary card** inside the board (the card is cut off at "Coming next" until scrolled).
- **The mouse wheel over a mark button does not zoom** (it zooms everywhere else on the stage).
- **The flat twin has no drag-to-pan** (keys, zoom buttons and the chapter strip move it).
- **Performance on real phones is unverified.** Measured only here: the slim land decodes in a few ms instead of the
  ≈ 90 ms index parse (unthrottled Node), but `deriveJourneyBoard` still takes ≈ 100 ms warm on the demo household and
  re-runs on every household change on the main thread; its test asserts < 400 ms on this machine, not a phone budget.
- **Small phones:** at 320×568 the stage between the folded summary and the Compass is only ≈ 140 px tall (the piece
  is in view, the chapter strip is not).
- **"Review and record…" focuses its row but does not scroll the due sheet to it** when the row is below the sheet's fold.
- Also: restoring a saved `selectedStopId` does not reopen its panel; the phone Sky piece is small (≈ 15 px) and relies
  on the "We are here" tag; a paid standing transfer with no recurring source disappears rather than reading paid; the
  crossroads preview could not be captured in a browser because the demo household generator creates no open crossroads
  (it is covered by the App and UI tests with the fixture household).

## Risk: Medium-High, and why

It changes the app's default arrival route for the illustrated edition, replaces the household Journey surface, adds a
new App door onto an existing writer surface (the Era planner with `runKitchen`), raises the due-reminders review over
the board, and touches `AddSlideshow` and `DuePreviewSheet`. It does not change money meaning, arithmetic, commands,
schema, sync, Auth/RLS or Hercules payloads, and every write still goes through an existing named Confirm; that keeps it
below High. The D-183 regression (`test/app-startup-p1.test.ts`, `test/month-rehearsal-mainline.test.ts`) is in the
gate's selection.

## Dual Course deltas

- **Budget (5): +1.** The home screen answers "where are we, what needs attention, what's next, what can I do" with
  honest statuses (expected ≠ confirmed, overdue ≠ paid, set aside ≠ paid), leads with the due reminders, and routes
  each stop to the real tool — expected pay through the reviewed recurrence path so the same stop turns confirmed. No
  arithmetic changed.
- **Engagement (3): +2.** The arrival home becomes a board over the real island: a piece that stands on today, chapters
  you can walk back through, crossroads you can preview without consequence, and an explicit door into Horizon at the
  same place.

## Data and environment disclosure

Fictional Development demo data only (the App's demo household generator and the test fixtures in
`test/fixtures/journey-board-*.ts`); no real household data was read, written or captured. Browser evidence was
captured in this sandbox with headless Chromium 1194 on SwiftShader software GL, against a local Vite dev server —
not a phone, not a real GPU, not the deployed site. No hosted service, Supabase row, Worker, secret or Production
setting was touched.

## Next owner and next action

**Jonathan** answers D49–D67 (below) — first D49/D65 (is this the arrival home to ship?) and D66 (due reminders as
the first attention item). Then **Codex** reviews the PR as integrator, runs the quick gate where Playwright's
headless shell and a working books-ready browser path exist, and a real-phone pass measures first paint and the
derive on a mid-range device before merge.

## Decisions Jonathan owes (plain words)

- **D49** Opening the app lands on the household Journey Board; the Mountain square stays one tap away in All tools.
- **D50** You only step into the Horizon by pressing "Enter Horizon here"; zooming the board never launches it.
- **D51** The board's route is a drawn path through the twelve month stations, not the carved trail; days appear when you zoom in.
- **D52** The household piece's look is saved per device; a shared look would need a new synced record.
- **D53** The board shows the shared "Our home" and your own customised home; shared exterior edits don't exist yet.
- **D54** Memory stops are only memories (and Wins) everyone kept; automatic "goal filled" notes are not memories.
- **D55** Calendar-order stations make the route cross itself: keep drawn crossings, or move/reorder stations in MANIFEST?
- **D56** The piece stands on today; an unclosed past month shows "close due" instead of holding the piece back.
- **D57** Your partner's home isn't on your device: show only their plot marker, or publish a shared silhouette (new synced record + trust review)?
- **D58** The board shows about a year (8 back, this month, 3 ahead); older months are in the list and Books.
- **D59** Weekly Sitdowns show only for this month, because Hearth keeps no "held" record for past weeks.
- **D60** Expected pay that passed unrecorded reads "Expected · not recorded" but doesn't count as needing attention.
- **D61** A home milestone earned but not yet saved shows as "ready to record" — or should it wait until saved?
- **D62** Station and district names are written into the board module; move them into MANIFEST instead?
- **D63** The board is north-up and gently angled, not the south-east framing SCALES.md described.
- **D64** "Open the Calendar" opens this month; jumping to the stop's date needs a small Calendar change later.
- **D65** The reading edition (simple view) still arrives at the Desk; the illustrated edition arrives at the Journey Board.
- **D66** The due reminders are the first "Needs attention" item and open as a sheet above the board; expected pay records through that same reviewed path.
- **D67** "Mark paid…" appears only once Bill paid can take the bill; duplicate postings show as one stop with "2 postings"; All tools ends a Horizon visit.
