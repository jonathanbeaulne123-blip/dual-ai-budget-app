# ROAD.md — Horizon Drive, finished as a piece of the world

Version 1.0 · 29 September 2026 · Owner: Jonathan (product) · Author: Claude (design lead)
Authority: Jonathan's brief of 29 September 2026, *"Implement: Horizon V2's Main Road — a beautiful, fully functional driving experience"* (implementation, not a proposal). Where this file and an older deck file disagree about the road, this file wins for the road and the older file is corrected in the same PR; `CONTRACT.md` hard rules still hold except where §0 names an override.

The standard is **Mountain v2**: its card kit, its road (`mountain/art/routeArt.ts` — swept bands, paler centre, pencil joints, dressed stone kerbs and parapets with piers) and its composed, seasonal planting (`mountain/planting.ts`, `mountain/art/plantArt.ts`).

Evidence of the road as it stood before this pass: `docs/horizon/evidence/road/audit-before/AUDIT.md` (41 BLOCKER / 298 MAJOR / 584 MINOR driving and corridor findings from the real cruiser sim) and `docs/horizon/evidence/road/before/` (34 in-app captures + `LOOK.md`).

---

## 0. Overrides and standing decisions (recorded in `docs/DECISIONS.md` as D-R1…D-R12)

| Id | Decision | Why | Status |
|---|---|---|---|
| D-R1 | The **corridor** (`WorldDefinition.corridors`, `src/harbour/horizon/land/corridor/types.ts`) is the one road definition. Deck, collision, kerbs, footways, guards, markings, lamps and planting derive from its stations; nothing re-derives a road line by hand. CONTRACT §4 gains the field in the same PR. | Brief §1: "one coherent road definition" | design lead |
| D-R2 | The README rule "nothing goes on the land before PIN-1" is superseded **for the road corridor** by Jonathan's explicit instruction of 29 Sep 2026. PIN-1 stays open. | Brief: implement, integrate, test | Jonathan's instruction |
| D-R3 | Road lamps light the world with a **bounded pool of shadowless point lights** (full 6, lite 2) assigned to the lamps nearest the camera and faded by distance, on top of the STYLE §1.11 pool decals and glow cards. This overrides STYLE §1.2 rule 1 ("no dynamic point lights") for road lamps only. | Brief §3/§7: lamps must genuinely illuminate, with a bounded strategy | Jonathan to confirm |
| D-R4 | **Palms** only on the Long Sands reach (the resort shore) and the Tideline waterfront; Newfoundland swaps them for wind-bent pine, Taylor keeps them as paper palms. Extends STYLE §3.2 (shore biome). | Brief §5: palms where coastal/resort, not everywhere | Jonathan to confirm |
| D-R5 | Geography stays `horizon-geo-1` (CONTRACT §2.14 applies from PIN-1; pass 5 set the precedent). The bake changes; the presence world string does not. | No PIN yet | design lead |
| D-R6 | A dev-only **`=` inspector** is added to the Horizon runtime (it did not exist on main). | Brief §9 names it | design lead |
| D-R7 | Road lantern = 5.2 eu post with an arm (a new STYLE §3.1 row); the 2.6 eu lantern post stays the walk/quay lantern. | A road lamp must light an 8 m carriageway | design lead |
| D-R8 | One planted-median boulevard at most per reach, only where §3's median test passes; every other "boulevard" is planted verges. | Brief §5: medians only where the road is wide enough | design lead |
| D-R9 | A road lantern's slim post may stand in a junction's sight triangle (ROAD §5 keeps planting over 0.6 out of it, not posts), never in a mouth; where the setback spot is taken it mounts on the kerb line; within 24 eu of a structure end it may stand on the approach's guard rail. | Brief §3: prioritise intersections and bridge approaches; the triangle rule left them dark | design lead (integration) |
| D-R10 | Junction aprons: a joining road's deck runs through the junction just under the through road and takes the through road's cross-fall, fading over 4 stations (its own centreline grade is kept). | §2.2, §2.4: no lip at a mouth | design lead (integration) |
| D-R11 | A structure deck edge whose own rail does not stop a body at the 0.2 / 0.65 contact levels is `bare`: the corridor guards it on the deck. A road trestle's rail is a board mounted on the deck's fascia. | §2.5; the Bight spur trestle let a rider under its rail to a 9 eu drop | design lead (integration) |
| D-R12 | The corridor measures drops, fills and planting against Mountain v2's own ground inside the region's footprint (the ground the rider meets), Horizon terrain elsewhere. | §1: one road definition that agrees with what is felt | design lead (integration) |

## 1. The corridor: one definition

Pipeline position (bake): `buildLandCuts` → crossings → terrain → **`settleBedEdges`** → … → **corridor build** (after the final ground and final bed points exist) → corridor solids replace the road beds' old edge solids → `createLandWorld` writes `world.corridors` and adds corridor lamps to `world.lights`.

- **Stations** every `CORRIDOR.step` (2 eu) along each road bed's final points: position, tangent, grade, context, reach, the two sides (edge kind, guard kind, measured drop, water distance, paved extent, footway band, planting band, gap).
- **Solids** (collision = what you see): one **continuous deck ribbon** per run (shared vertices, no prism cracks; the deck top is the stations' surface), shoulders, kerbs (0.15 × 0.25), sidewalks (kerb height, dropped kerbs at crossings and entrances, ramps ≤ 8 %), retaining walls where the road is in a cutting, and **guard colliders** built from each `GuardRun.line` (a continuous smooth panel inside the visible rail's volume — never wider, never across a gap; CONTRACT §2.4).
- **Where a structure owns the road** (bridge decks, the gallery floor, tunnel floors), the station carries `structureId` and the corridor emits no second deck and no second rail: the structure's deck and one rail family (`bridgeRail`) are the road there. This removes today's double deck and double parapets.
- **Footways**: where the Year Walk already runs beside the road, it is the footway (`edge:'yearWalk'`); it is connected, never duplicated. New sidewalks are beds of kind `walk` (ids `<road>.walk.<side>.<n>`) so tap-to-walk routes over them.
- Section (MANIFEST `profiles.road`): two 4 m lanes, 1 m shoulders (paved half 5), kerb at the paved edge where the context wants one, sidewalk 2.2 beyond it. A median boulevard keeps both carriageways ≥ 5 m (4 m lane + shoulders) and adds a median of 3 m; its ends are rounded noses set back 12 m from any junction mouth.

## 2. Driving acceptance (the road must pass these before anything is dressed)

Measured by `node scripts/horizon/road-audit.mjs` (real `stepCruiser`, both directions, centre and keep-right lines):
1. **0 BLOCKER** on every road bed (V01, VG, V03, VBS, the six spurs, the plot service roads).
2. On the carriageway: no lip > 0.05 eu between consecutive samples; no crack; no airborne event on any pass; no stall; no contact while in lane.
3. Usable width ≥ 9.5 eu on V01, VG and V03 (paved 10), ≥ 8 on structure decks between rails, ≥ 4.5 on spurs.
4. Grade ≤ 12 % everywhere, ≤ 10 % on V01 except the named Prow exception (≤ 13 % for ≤ 150 m); no grade change sharper than 4 % per 10 m (no crests that launch at 16 m/s).
5. A guard wherever the drop within 1.5 eu of the paved edge exceeds `CORRIDOR.guardDrop` (1.25), except at a declared gap with its own edge (a flush entrance, a viewpoint with its own wall).
6. Headroom ≥ 5 eu over the whole carriageway; nothing (rail, ramp, handrail, post, canopy) inside the carriageway + 1 eu.
7. Bridge and tunnel transitions: the road surface and the structure deck agree within 0.02 eu at every span end; the lateral axis of every span matches the road's centreline within 0.25 eu.
8. Board, bicycle and walker suites stay green; nothing in this pass changes vehicle physics, adds steering assist or snaps a vehicle to a line.

## 3. Reaches: the road changes character with its land

Reaches are authored by anchors (MANIFEST V01 points) and resolved to stations at bake time. Classification inside a reach may still mark individual stations `structure` (a span) or give a side a gap.

| Reach | From → to (V01 anchors) | Context | Treatment |
|---|---|---|---|
| R1 Harbour Gate | [1400,1060] → [1543,1001] | developed | Kerbs; continuous sidewalk on the town side; the Year Walk as the other footway; lamps 24 m staggered; zebra at the upper street and at the Year Walk crossing; street trees in pits on the town side only. |
| R2 Prow Gallery | [1543,1001] → [1599.5,790.8] | structure | The gallery owns the road: colonnade parapet only; tunnel lamps every 15 m under the roof; the Terraces laybys flush with the road (entrances, dropped kerb, no lip); a lantern pair at the Mountain Road junction. |
| R3 Prow Cliff Drive | [1599.5,790.8] → [1560,500] | mountain | Stone parapet with piers where the cliff drops; no kerbs on the hill side (shoulder into the rock cut, retaining where cut); no lamps; no planting on the sea side. |
| R4 Crown Coast | [1560,500] → [1120,250] | coastal | The high sea road: low post-and-rail on the sea side where the drop needs a guard (below the rider's eye so the sea stays in view); stone parapet only on the tight outer curves round the north-east corner; wind-bent pine and heath framed in groups inland; **Crown Lookout** pull-off at the biggest drop, joined to the Year Walk. |
| R5 Scholars' Crest | [1120,250] → [720,300] | developed at the Green Road / library junction and station.oct; open elsewhere | Junction box: kerbs, sidewalks to the library spur and station.oct, zebra, lamps; between them woodland groves (white pine, birch, maple) framing the road — the "wooded section". |
| R6 West Rise | [720,300] → [400,470] | open → coastal | The trees thin and the west sea opens ahead (the reveal); shoulders and edge lines; no dressing. |
| R7 Flats Coast | [400,470] → [390,850] | coastal (the Flats) | Prairie verges (coneflower, bluestem, yarrow in drifts) with gaps at every view; post-and-rail at drops; a lamp pair at station.jul. |
| R8 Bight Descent | [390,850] → [460,1030] | mountain | Terrain-sensitive: embankment and retaining where the road hangs over the land today; stone parapet on the outer side; the Bight Bridge and the lagoon revealed on the way down. |
| R9 Bight Bridge | [460,1030] → [660,1170] | structure | The bridge owns the road: one rail family, bridge lanterns every 30 m on the kerb rail between V01 and the footway (never on the sea edge); the skate ramps kept outside the carriageway. |
| R10 Long Sands Boulevard | [660,1170] → [1100,1400] | boulevard | The resort boulevard: palm groves and flower beds (beach rose, sea thrift, lupine) on the verges, a planted median on the widest straight where §1's median test passes, lamps 28 m, zebra at the Year Walk crossing; the dune culvert is a structure with its own rail. |
| R11 Tideline & Campfire | [1100,1400] → [1300,1380] | developed at Tideline Park, then coastal | Sidewalk and kerbs at the park (the park pad flush with the footway, no drop), lamps; then open to the water toward the campfire. |
| R12 Quay Crossing | [1300,1380] → [1370,1260] | structure + developed | The Quay Bridge owns the road (one rail family, bollards, lanterns); the boathouse spur and homestead landing entrances flush; S3's separated lane outside the carriageway. |
| R13 Harbour Avenue | [1370,1260] → [1400,1060] | boulevard → developed | Back into town: a maple avenue with planted verges, kerbs and sidewalks as it reaches the harbour, lamps; the loop closes at the Green Road junction. |

Other roads:
- **V03 Mountain Road** — mountain: stone parapets, tunnel lamps every 15 m, the canal bridge's own rail, framing trees only where Mountain v2's own planting reaches it; lamps at both portals and the junction.
- **VG Green Road** — open; inside the Green's protected centre (r 160) nothing taller than 0.85 (STYLE rule 12): low flower verges only; the High Span owns the road on its deck; lamps at both junctions and the span approaches.
- **VBS spur and the six spurs** — entrances: flush joins, dropped kerbs, guard gaps, a lamp at developed destinations (library, glasshouse, studio, cottage, boathouse, upper street).
- **Plot service roads** — flush entries, no dressing (the reserves stay "in construction").

## 4. The kit: one family (card kit, three dressings)

All pieces are card-kit geometry (`src/harbour/art/cardScene.ts`, `cardKit.ts`), batched per card cell, repeated pieces instanced; Classic, Taylor and Newfoundland dressings for every piece (AGENTS.md theme rule).

1. **Pavement** — STYLE §1.5 `paved` worn road `#c9b891`; swept bands like `ROAD_BANDS` (darker edge band, paler wheel lanes, a paler crown), pencil slab joints every ~6 eu, ink on cut edges; wet/snow states per STYLE §1.5 when a weather state exists (main has none: the road simply stays readable in every season; winter keeps a cleared centre).
2. **Markings** — warm white `#efe7d2`, flat decals on the deck following stations (never a stretched texture), polygon-offset, merged per cell: centre dash 3 on / 6 off (0.12 wide) on V01/VG/V03 outside junction boxes; centre solid on blind curves (sight < 60 eu) and along a median's nose approach; edge line 0.12 at 0.2 inside the paved edge only where there is no kerb; give-way dashes at spur mouths; zebra (0.5 bars, 0.5 gaps, 3 wide) at pedestrian crossings. Night: the markings take the night chalk.
3. **Kerbs and sidewalks** — dressed stone kerb 0.15 × 0.25 with coping ink; sidewalk flags `plaza`-like `#d3bf99` with pencil seams every 1.2 eu; dropped kerbs 3 eu at crossings and entrances; sidewalk ends always meet something (a crossing, a path, an entrance, a footway) — never a guard or a wall.
4. **Guards** — `stoneParapet` 0.95 + coping, coursed stone with piers every 12 eu (Mountain v2 look); `postRail` 0.85: timber posts every 2.5 eu with a steel-banded top rail and a mid rail, ends buried or flared; `bridgeRail`: the structure's own; runs begin and end deliberately (pier, buried end, flare) and never line a flat stretch "to look finished".
5. **Streetlights** — road lantern 5.2 eu post + arm + lantern (C brass lantern, T washi lantern, N storm lantern on a rope bracket), set back 0.9 eu behind the kerb or shoulder, never in the driven or walked space; bridge lanterns on the rail posts; tunnel lamps on the wall; bollards on the Quay. Colour `#ffd98e`. Lit on the world clock (§6).
6. **Planting** — Mountain v2's archetypes (round, fruit, birch, pine, poplar, alpine; shrub, flowering, hedge, heath) plus three new card archetypes in the same style: `palm`, `flowerBed` (a low composed bed of 2–3 flower colours with an edging stone), `grassTuft`. Composed groups (STYLE §1.4.1: groves of 5–12, clearings between), never a spline scatter; seasonal via the same season value the region uses.
7. **Scenic stops** — a flagged pull-off with a low stone wall, a bench and a lamp; joined to the road by a flush entrance and to the Year Walk by a path.

## 5. Planting rules

Nothing grows on the paved road (STYLE rule 10). Trunks ≥ `CORRIDOR.plantingSetback` + canopy radius from the paved edge; no canopy over the carriageway or below 5 eu over a footway; nothing taller than 0.6 inside a junction's sight triangle (35 eu along each approach); gaps at every declared view, entrance and crossing; the sea side of coastal reaches stays open except named groups; palms only per D-R4; the Green's protected centre ≤ 0.85.

## 6. Night, weather, cameras

- **Clock**: the existing world clock (`sun/solar.ts`, `runtime.setLight`); lamps ramp on with the sun's elevation between +2° and −6° (civil dusk), come on along a line in sequence (LIGHT §3), and ramp off at dawn. No separate schedule.
- **Light**: STYLE §1.11 glow card + halo + pool decal per lamp (pool radius `CORRIDOR.lampPoolRadius`, overlapping so the road never alternates bright and dark) + the D-R3 point-light pool. Daylight: the fixtures are simply part of the street.
- **Weather**: there is no weather system on main; nothing here invents one. Seasons: planting follows the season; the road stays readable in every season.
- **Cameras**: activity, first-person and floating are the existing three; nothing adds a camera. Lamp posts, rails and trees stay out of the rider's forward view cone at activity-camera height; foliage never overlaps the rider.

## 7. The Journey map

The Journey land keeps the road's route (rebake), draws bridges as bridges (deck + rails at map scale) and the boulevard reaches as a road with a planted band; no lamps, kerbs, rails or single plants at the default scale. The board route, stations and financial stops do not move.

## 8. Performance

Per district added by the corridor: ≤ 25k triangles full / 10k lite, ≤ 12 draw calls; lamps, posts and plants instanced per archetype; markings and kerbs merged per card cell; point-light pool fixed at 6 / 2 (no shader recompiles at dusk); detail thins with distance (STYLE §1.2 ink rule; lite: glow cards only beyond 30 eu) — never a visible pop in front of the rider.

## 9. Modules

| Module | Owns |
|---|---|
| `land/corridor/types.ts` | the contract (this file's data) |
| `land/corridor/stations.ts`, `solids.ts`, `reaches.ts` | stations, classification, reach table, the corridor's solids, sidewalk beds (bake) |
| `land/corridor/plan.ts` | markings, guard runs, lamps, planting groups, scenic stops from stations (pure, deterministic) |
| `runtime/corridorArt.ts`, `kit/road/**` | pavement banding, markings, kerb/sidewalk art, guard kits, lamp posts, stop furniture, three dressings |
| `runtime/corridorPlanting.ts`, `kit/plants/**` | planting groups drawn with the v2 plant archetypes + palm / flowerBed / grassTuft, seasons, lite LOD |
| `runtime/roadLights.ts`, `sky/night.ts` | lamp anchors, dusk ramp, sequence, pool decals, the point-light pool |
| `runtime/inspector.ts` | the `=` inspector |
| `src/journey/land/**` | bridges and boulevards on the Journey land |
| `scripts/horizon/road-audit.mjs`, `capture-road.mjs` | the evidence |
