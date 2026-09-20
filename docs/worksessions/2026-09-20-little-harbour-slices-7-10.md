# Hearth worksession — Little Harbour slices 7–10: the Kitchen's recipe card, the Boathouse interior, the Library, the island walk

- **Status:** OPEN — local branch candidate, ready for Jonathan's eye and a PR
- **Opened:** 2026-09-20 (`America/Toronto`), same day as slices 1–6
- **Assignee or AI:** Claude (architect + writer, one checkout)
- **Repository:** `dual-ai-budget-app` · **Branch:** `claude/little-harbour` (continues slices 3–6, from `1706382`)
- **PR or issue:** none — not pushed (the session's git proxy refuses this repo)
- **Risk:** Medium (presentation and routing only; no money meaning, writer, schema, sync, Auth/RLS or Hercules payload change)
- **Environment impact:** Development only, behind `VITE_HEARTH_HARBOUR` (requires `VITE_HEARTH_HOUSE_WORLD`)

## What Jonathan asked

"Do these task: the Kitchen's five-question recipe card, the Boathouse interior, the Library, and the island walk." — the four rooms slices 3–6 left named but unbuilt (LITTLE_HARBOUR_v2 §§4–6 and the island plan).

## Slice 7 — the Kitchen: five questions, one card (D-292)

Kitchen-table's `middle` and `below` open onto a timber cottage: table, drawer with a brass pull, the conversation folio, Hercules seated across, the hearth with the kettle's warm point light, the window with day through it.

- **The empty card** lies on the table, spun so its words read from where the room pose stands: "The empty card — sit down: five questions, one card."
- **The cookbook wall:** every line of the month's standing Plan pinned as a five-line recipe card — *what — how much · by when · from which pot · who* (`cardWords`) — each with a wax seal in its lens colour, gridded (`cardPin`) on the back wall left of the window. Capped at 12; the rest live "in the drawer" (said in words on the table plate).
- **A proposed plan waits:** a face-down card on the table until `planAcknowledgementState` says both members have sat; the table plate names who hasn't.
- **The wizard is not in the room.** The empty card, the drawer, each pinned card and Hercules' chair are doors onto the existing Plan Studio (a card carries `line/<id>` as its object); the folio opens the conversation. The five questions are asked on the paper that owns Confirm. `src/harbour/**` writes nothing.
- Reading is pure (`buildKitchenReading`): `currentPlanVersion(household, "household", month)`, a decision's `targetCents`/`deadline` preferred over the line's own amount/due date, responsibility → *both of you / yours / the partner's*.

Journey keeps the house's own atlas at kitchen-table `above` (`HARBOUR_ROOMS` leaves the level to the house).

## Slice 8 — the Boathouse interior (D-293)

Together's every level enters the boat-shed on the shore: the slip of water down the middle of the deck (the water sits at −0.03/−0.012 because **the island's terrace lies at −0.05 under every room** — the first cut drowned it), the rowboat floating in it (a stretched open hemisphere with a gunwale ring — the first two hulls read as a capped drum and a submerged shell), the sail on the back wall hung clear of the strakes (they z-fought at −2.78), the projector on its crate with a faint beam, lanterns from the rafters (one lit per wish, min two unlit), the memory shelf, the clay workbench, the writing desk.

**Counts, never contents:** "3 ideas in the light", "nothing yet" (`fewWords`) — wishes can be private, so the room never prints one. Every station is a door: wishes → the lantern surface, projector/memories → their surfaces, workbench → Pottery Studio, desk → letters, the rowboat ("room for you and *partner*") → encounters. Reading is pure (`buildBoathouseReading`): counts of shared `hearthside` rows only.

## Slice 9 — the Library (D-294)

Study's `middle` — the Standing Book keeps its own hall now. Two-storey stone courses, the tall window with its light shaft, the lectern with the great book open ("every figure has a source" on a floor plate at its foot), open bookcases with instanced coloured spines on both side walls (left case takes the front half of its wall — the Bindery bench has the back; right case takes the back half — the Time Machine's desk has the front; the first cut buried the books inside a solid box), the balcony with the accounts as rail stickies, the five Bindery machines named as the vision names them (Lantern Row, Low Water, Cut Bank, The Glasshouse pane, The Handoff bench), the Time Machine desk with brass wheel and lens, and the garden door with the Glasshouse glimpsed behind the hall (a way, zoned `landmark`).

Every station is a door onto the Standing Book's existing surface; the room holds no reading and `update` is a no-op — an empty household and a full one stand the same hall.

## Slice 10 — the island walk (D-295)

Three exteriors join the Boathouse on the lawn, each placed by `groundHeightAt` and faced toward the Court: the Library's stone hall (cone roof, tall lit window), the Glasshouse's white-ribbed shed (translucent panes), the Kitchen's cottage (chimney, smoke, one warm window). Each is an anchor zoned `landmark`; a new pure table `HARBOUR_LANDMARKS` (id → room + level) is checked in `HarbourWorld.activate` **after ways** — walking to a building navigates the app's own route to that room, exactly as the compass would. The Court's mesh budget rises 68 → 84 for the three exteriors (asserted in `test/harbour-dressing.test.ts`).

## Routing, holds, reading editions

- `HarbourPlaceId` grew `kitchen | boathouse | library`; `HARBOUR_ROOMS`: study middle → library, kitchen-table middle/below → kitchen, together (all levels) → boathouse.
- `PLACE_HOLDS` for all three rooms; every named pose proven inside its hold by `holdPoseInRoom` in `test/harbour-rooms.test.ts`.
- Reading editions (`PlaceFlat`): the Kitchen's cards as real buttons with the sit-down line, the Boathouse's six stations with their counts, the Library's three doors — distinct flat compositions, no WebGL.
- The evidence pipeline learned the three rooms (`scripts/capture-little-harbour-evidence.py`: `ROOMS`/`LEVELS`/`PLACE_TWIN` + legs 13–17).

## Verification

- `pnpm exec tsc --noEmit` clean; `vitest run test/harbour-*.test.ts test/house-*.test.ts test/app-startup-p1.test.ts` — **27 files, 357 tests, all passing**, including the new `test/harbour-rooms.test.ts` (kitchen reading: five-line mapping, decision precedence, proposed/waiting via real `planAcknowledgementState`, cap/overflow; scene doors-only guarantees; per-room ≤120 mesh budget; poses inside holds).
- `VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 vite build` passes.
- **Looked at, not just captured:** every room probed at 1440 and 390 in all three themes and the defects fixed on the evidence — the kitchen camera standing in the doorway (was: nose against the table), the card text spun to read from it, the cookbook wall moved into the standing view, the drowned slip raised over the terrace, the capped-drum rowboat recut as an open dish, the sail unstuck from the strakes, the water's specular blob roughened away, the buried spines given open cases, the bindery/bookcase overlap split front/back.
- Evidence: `docs/evidence/little-harbour-slice7-10/` (classic · taylor · newfoundland × 1440 · 390, rooms + door sheets).

## Uncertainty and next

- The demo seed has no standing plan for the month, so the demo kitchen shows the empty card and a bare wall (correct, but Jonathan should also look with a real plan standing).
- Deep links per Bindery machine, the Glasshouse's private side bench, the Boathouse's lantern-lighting flow and the Journey atlas room remain later slices.
- Not pushed (proxy refuses this repository): delivered as bundle + patch to `~/Downloads/little-harbour-slice2/`.
