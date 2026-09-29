# Pass 5 — Mountain v2 on the Horizon (Horizon v2, segment 1)

Version 1.0 · 28 September 2026 · Owner: Jonathan · Author: Claude (design lead, integrator) · Builders: Claude subagents, one per track, one writer per file · Base: `main@9fed600` · Branch: `claude/horizon-v2-mountain`

Jonathan's direction (28 Sep): *"There is a particular charm, asset quality and sense of composition in Mountain v2 that I want to preserve … bring a slightly stripped-down version of the actual Mountain v2 into Horizon and use it as the standard we expand from … Roads, mountains, trees, the dam, bridges and the gondola … less clutter, stronger composition, the original quality preserved."* His rulings: **summit on summit** (D-M1), **v2's dam holds the Fund** (D-M3), push and merge if possible.

`CONTRACT.md` still wins over this brief. This pass keeps `horizon-geo-1` (the Horizon is not pinned and no household has a saved body on it; CONTRACT §2.14 applies from PIN-1).

## 0. The one idea

Mountain v2 is not rebuilt and not re-shaped. It is **placed**: its geography, art and rides run in their own coordinates and stand on the Horizon under one translation, `src/harbour/horizon/regions/mountainV2/placement.ts`:

```
horizon = native + {x:1308, y:54, z:764}      (v2 summit (2,104,−294) → Crown summit [1310,470] h 158)
```

The Horizon owns the world around it and the seams: the bake carries v2's ground so the Journey scale, the distant tiles and the proofs agree; the runtime hands the footprint to the region, which draws v2's own ground lattice and art and answers ground, deck and collision queries exactly.

## 1. Decisions (recorded in `docs/DECISIONS.md` by track T4)

| Id | Decision | Status |
|---|---|---|
| D-M1 | v2 stands 1:1, summit on the Crown summit; town foot at h 54 on the Stillwater terrace east of the lake | Jonathan, 28 Sep |
| D-M2 | South of v2's summit line (native z ≥ −294) v2's ground wins inside its footprint; north of it the higher of v2 and the Crown's own north face wins, so the Throat, its collar and the skylight keep their cliff. Feather 40 m at the footprint edge. | Design lead (this brief) |
| D-M3 | v2's glass dam is the one Fund picture: `L01` moves to its crest plaques; the Stillwater dam, apron, gallery and `damPortage` are removed; Stillwater drains over a natural rock sill into the Notch | Jonathan, 28 Sep |
| D-M4 | Crown Road (V02) and the Shoulder Tunnel are retired; v2's own road is the mountain's road. Wheels reach its foot by a new spur **V03 "Mountain Road"** from Horizon Drive's Prow cliff drive (near the Terraces lay-bys) to v2's road foot | Design lead; confirm |
| D-M5 | S1 Summit to Sea: the upper half is v2's race course (its road, 17 gates, named segments, the quay finish at v2's foot); the Horizon S1 continues from there to the sill, the Notch shelf, the Reach and the quay. The Shoulder sweep, the seven-leg Lakeside ramp, the sledding meadow bed and the Cup tarn are retired | Design lead; confirm |
| D-M6 | G1 is v2's gondola (quay station at v2's foot → summit, three towers, gorge reveal). The Little Harbour → v2-quay lower leg is a follow-up decision (`D-M6b`), not built here | Design lead; confirm |
| D-M7 | The Ore Line's South Portal drops to v2's ground at its position; the Undercroft rooms are unchanged (all ≥ 40 m below the new surface) | Design lead |
| D-M8 | "Stripped down" list (§4): what is not drawn in this pass. Source stays; nothing is deleted from `src/harbour/mountain/**` | Design lead; Jonathan may add or restore items |
| D-M9 | v2's four tool buildings (home, cottage, library, glasshouse) are not drawn: their tools live in the Horizon hosts. Their terraces stay as open shelves. The observatory (`L02`) and the goal pavilion (as a plain shelter) are drawn | Design lead |
| D-M10 | Pages A, E, F, G re-posed only as far as the new ground requires; old values kept as `v2_5` | Design lead; Jonathan confirms by eye |

## 2. Tracks and ownership (never two writers on one file)

| Track | Owns | Must not touch |
|---|---|---|
| **T1 Land** | `src/harbour/horizon/land/**`, `src/harbour/horizon/world/MANIFEST.json`, `scripts/horizon/**`, `public/horizon/**` (the re-bake), `test/horizon{Landforms,TerrainCuts,Beds,Structures,Water,Thresholds,Crossings,Views,Journeys,WalkOut,Wave4,Wave6,Reconcile2,LandRepairs,Underground}.test.ts` and any test that reads the bake | `regions/**`, `runtime/**`, `movers/**`, `docs/**` (writes its notes to `HANDOFF-notes/land.md`) |
| **T2 Region** | `src/harbour/horizon/regions/mountainV2/**` (except `placement.ts`), `src/harbour/horizon/runtime/{index,cards,geography,cableLayer}.ts`, `src/harbour/horizon/world/{definition,build}.ts` (region fields only), new `test/horizonMountainRegion*.test.ts` | `land/**`, `MANIFEST.json`, `movers/**`, `src/harbour/mountain/**` (read only; add exports there only through T2's `HANDOFF-notes/region.md` request to the integrator) |
| **T3 Rides** | `src/harbour/horizon/movers/gondola/**`, `movers/shared/{mode,registry}.ts` (alias rows only), `runtime/moverInput.ts` (registry rows only), new `test/horizonGondola*.test.ts` | everything else; consumes T2's `regions/mountainV2/rides.ts` interface (below) |
| **T4 Deck and Journey** | `docs/horizon/**` (README v2.6 deltas, STYLE §2.7, CONTRACT §4 region fields, DECISIONS, this brief's status), `docs/horizon/make_manifest.py` (mirror T1's manifest edits), `docs/DECISIONS.md`, `docs/worksessions/2026-09-28-horizon-v2-mountain.md` | code |
| **Integrator** (Claude, this chat) | `placement.ts`, wiring conflicts, the re-bake commit, evidence runs, the PR | — |

Shared interface (written by the integrator on the first commit, extended only by its owner): `regions/mountainV2/placement.ts`. T2 publishes `regions/mountainV2/index.ts` with:

```ts
export interface MountainV2Region {
  offset: typeof MOUNTAIN_V2_OFFSET;
  contains(hx: number, hz: number): boolean;                 // inside the drawn footprint
  groundAt(hx: number, hz: number): number | null;           // exact v2 ground (+offset y), null outside
  surface(hx: number, hy: number, hz: number, step: number): {id:string;y:number;n:[number,number,number];material:string;slope:number} | null; // decks: bridges, dam crest, platforms
  blocked(hx: number, hy: number, hz: number, r: number): boolean;   // v2 solids + edge solids
  ceiling(hx: number, hy: number, hz: number): number | null;
  pathGraph(): { nodes: {id:string; at:[number,number,number]; kind:string}[]; edges: {id:string; from:string; to:string; points:[number,number,number][]; kind:string}[] }; // horizon space
  rides: { lines: Record<'gondola'|'funicular', {stations: {id:string; name:string; at:[number,number,number]; yaw:number}[]}>; createRide: typeof import('../../../body/ride.ts').createRide; curve(kind:'gondola'|'funicular', from:number, to:number): {at:[number,number,number]; yaw:number; pitch:number; cabin:boolean}[] };
  mount(scene: THREE.Scene, tier: 'full'|'lite', dressing: PlaceDressing): { group: THREE.Group; animate(dt:number, clock:number): void; setTransit(cabin: {at:[number,number,number]; yaw:number; pitch:number} | null, kind:'gondola'|'funicular'): void; setFund(level: number | null, reserve: number): void; dispose(): void };
}
export function createMountainV2Region(): MountainV2Region;
```

## 3. What each track builds

### T1 Land (Codex-style land pass, Claude subagent)
1. **Ground override** in `land/terrain/index.ts` `baseHeight`: inside `MOUNTAIN_V2_FOOTPRINT`, sample v2's baked ground grid (`public/mountain/terrain/hearth-mountain-geo-2.bin`, decoded with `src/harbour/mountain/terrainAsset.ts decodeTerrainAsset` in Node; **never import `definition.ts` into the bake**) and apply D-M2; feather 40 m into the surrounding bands; v2's flat town island (native z ≥ −48, r 84) becomes the Foot terrace at h 54, blended into the Stillwater terrace and the lake shore (the lake wins where they meet). The Crown summit stays the island's highest point (158; `test/horizonLandforms`).
2. **Manifest (v2.6)**: remove `roads.V02`, `structures.shoulderTunnel`, `structures.dam`, `structures.lakesideSwitchback`, `underground.damGallery`, `water.cup`, `water.river.upper`, `thresholds.damPortage`, `pastimeData.sledding`'s bed; add `roads.V03` (Mountain Road spur: from V01 on the Prow cliff drive between the Terraces lay-bys, ≤ 10 %, to v2's road foot `[1282,54,720]`-ish, exact point from v2 `MOUNTAIN_ROAD_LINE.samples[0]` + offset); `water.river.lower` gains the v2 river's continuation from v2's town channel end (native (9,−0.1,69) → `[1317,833]`) west into Stillwater's east shore; `water.stillwater` unchanged (its sill at the Notch head is the new outlet, `stillwaterSill` kept as a natural lip, no structure); `places.L01` → v2's dam crest plaque (native `DAM_PARTS.promenade[6]` + offset ≈ `[1316,142,514]`); `skate.S1.pts` upper half replaced by v2 `MOUNTAIN_COURSE_POINTS` + offset down to v2's finish, then the existing points from the sill on; segment names from v2 `MOUNTAIN_RACE_SEGMENTS` + the Horizon's remaining three; `cable.G1` = v2 `GONDOLA_LINE` stations/towers + offset (data; T3 rides it); `rail.ORE` portal h per D-M7; `thresholds.gondolaBase/gondolaTop` at v2's quay/summit platforms; `crownLaunch` unchanged unless it collides with the observatory (report); `walks.crown` and the Year Walk's January lane re-laid on v2's road verge / paths (`yearWalk.shares` on v2 edges is T2's graph — T1 lays the January stretch on v2's road centreline offset 5 m, pins per station); `views` A/F/E/G per D-M10; `journeys` targets re-measured; `names` additions only.
3. **Re-bake** (`pnpm horizon:bake`), resolve conflicts inside and within 60 m of the footprint, keep every Horizon bed outside the footprint as is. Report the conflict count before/after in `HANDOFF-notes/land.md`. Run every suite in its ownership list; update expectations that changed because of the ruling, never to hide a defect.
4. `docs/horizon/make_manifest.py`: T4 mirrors; T1 lists every manifest edit as a table in `HANDOFF-notes/land.md`.

### T2 Region
1. `regions/mountainV2/ground.ts`: v2 ground/lattice in native space via `scene/groundPaint.ts buildLattice/groundMasks/paintGround` (**never `createGround`**), returned as one mesh per tier under the host group; hide the Horizon terrain tiles whose cell centre lies inside the footprint when the region is mounted (`runtime/cards.ts buildTerrainSteps` gets a `skip(x,z)` predicate).
2. `regions/mountainV2/scene.ts`: one `CardBuilder` (+ a glass builder) and the v2 builders per §4's keep list, `buildDamWater().set(level, reserve)` fed by the runtime's BasinReading (the Horizon already reads it for L01; the region reads nothing itself — CONTRACT §2.2), `buildPlantArt`, `buildRockArt`, `buildTransportArt` + `buildCabin`, `pavilion`, `observatory`; `CARD_CLOCK` is driven by the Horizon runtime, never by the region.
3. `regions/mountainV2/geography.ts`: the `MountainV2Region` queries over v2's `groundHeightAt`, `queryWorldSurface`, `worldCollisionAt`, `worldCeilingAt`, `EDGE_SOLIDS`, `WORLD_SOLIDS` (native, offset in/out); registered with `runtime/geography.ts addDynamic` and consulted **before** the terrain inside the footprint.
4. `regions/mountainV2/graph.ts`: v2 `MOUNTAIN_PATH_GRAPH` translated; `world/pathGraph.ts buildPathGraph` accepts `extraGraph` so the Horizon walk plan, walk-outs and journeys cross the seam (the foot joins V03 and the Foot terrace; the summit joins the launch deck and the Crown walk remnant).
5. Streaming: the region mounts with the `crown` district's residency and counts against its budget; report triangles per tier in `HANDOFF-notes/region.md` (CONTRACT §6: 150k full / 60k lite per district — if v2 exceeds it, the region is its own residency unit with its own line in the budget table; say so).
6. `audio.ts` hazard: the Horizon's `createWorldAmbience` evaluates v2 geography at Horizon coordinates; route it through the region's native adapter.
7. Tests: region contains/ground/surface parity with v2 (same numbers + offset), the seam (ground continuous within 0.5 m across the feather at 8 probe points), the hidden-tile predicate, budget numbers recorded.

### T3 Rides
`movers/gondola/`: a `'gondola'` `ModeController` (and `'funicular'`) built on `src/harbour/body/ride.ts createRide` and `src/harbour/camera/rideCamera.ts createRideCamera` in native space through `region.rides`; boarding by the Horizon threshold offer (`gondolaBase`/`gondolaTop`, plus funicular platforms as thresholds `funicular.*`); cabin pose → `region.mount().setTransit`; reduced motion = cut to the far platform; calm view = cabins parked. Tests: a full ride start→end in simulated time, offers at both platforms, reduced-motion cut, no money read.

### T4 Deck and Journey
README v2.6 deltas; STYLE §2.7 amended (the mountain's built shapes are v2's kit list; trees below the alpine line as v2 plants them); CONTRACT §4 gains `regions[]`; DECISIONS D-M1…D-M10 in `docs/horizon/DECISIONS.md` and `docs/DECISIONS.md` (one entry, Jonathan's rulings quoted); `make_manifest.py` mirrored to T1's table; the worksession file; this brief's status line.

## 4. Stripped down: what is drawn and what is not (D-M8)

**Drawn (the scene):** v2 ground and paint; the swept road with kerbs, parapets, retaining walls and stairs; Orchard Lane; the three typed gorge bridges, the funicular viaducts and the path footbridges; the gorge and river with foam; the glass dam with abutments, crest promenade, plaques, apron, outlet, the Kitty chambers and the reservoir water; the funicular (rails, sleepers, bents, stations, cabins) and the gondola (towers, ropes, terminals, cabins); the observatory; the goal pavilion as a plain shelter; trees, shrubs, hedges, heath, rocks and strata, flowers and tufts as v2 plants them; overlook platforms; the flying flock (full tier).

**Not drawn in this pass (source kept):** the town square, storefronts, road-foot gate, town channel kerbs and culverts, canal bridge; the monorail; district fixtures (beds, logs, crates, planters) and biome ground detail props; signposts, cairns, beehives, woodpile, viewers, quay bollards, benches (except one at each overlook); pennants and laundry cloth; the waterwheel; chimney smoke; survey stakes, string and hoardings on the plots; engraved sign plates and wear fences; interaction gates and bells (the bell rope belongs to the Undercroft's Bell Gallery in a later pass); moths and butterflies; the four tool buildings and Hercules's cottage; station huts keep their canopy but not their goods.

Rule for anything not listed: draw it only if it improves the silhouette, establishes scale, clarifies a route, frames a view or supports a landmark. Empty space is part of the result.

## 5. Acceptance (integrator, then Jonathan by eye)

- `tsc` 0 errors; every suite in each track's list green; `pnpm horizon:check` byte-exact; `pnpm build` green; the quick gate `--risk=high` on the final SHA (time-budget breach reported, not hidden).
- Captures (headless, `scripts/horizon/capture.mjs` + a region capture script): page A (the square: v2's face above the Notch), page E (the summit), page F (v2's dam crest), a reference-like scenic view from v2's Foot looking up the gorge (the old town-arrival composition), an island overview from the Lamp (page B), the three seams (V03 at the road foot, the Foot terrace at the lake shore, the Crown's north face), before/after against candidate 6's pages.
- Walks: square → V03 → road foot → summit on foot (path graph crosses the seam); summit → dam crest → Library terrace; walk-outs from A, E, F land dry.
- Rides: gondola quay → summit with the reveal; funicular town → reservoir.
- Nothing financial on the mountain except `L01` at the dam plaques (BasinReading only); no record, progress or navigation from the old world is ported (`MountainPanel`, `mountainTravel`, the district bar stay out).

## 6. Status

Built on branch `claude/horizon-v2-mountain`; **PR #566 merged to `main` as `0015a8a` (Jonathan, 2026-09-29 01:20 UTC)**. Deployed: the Workers build on `0015a8a` succeeded at 01:30 UTC and the live worker serves the new `main` (the shell and `mountain/terrain/hearth-mountain-geo-2.bin` answer; every check on the PR head `7059fa3` — test, pages, assets Node 22/24, iOS, Android, Workers — was green). Not live-visible by design, with one pre-existing exception: the Horizon's assets are not deployed (`public/.assetsignore` drops `/horizon/**`; `horizon-review.html` is not served) and `?world=horizon` is `HARBOUR_DEV`-only, so this pass's world cannot open on the live URL — but the Home Book's **Visit my saved home** still routes to `HorizonEdition` regardless of `HARBOUR_DEV` (`src/harbour/HarbourWorld.tsx`, since #564, before this pass), where `mountHorizonWorld` refuses with "Horizon is available only in development." as the stage's status text (`HorizonStage.tsx` catch): a dead end a live household can reach, not a crash, and not gated by this pass (PR #568 Codex P2; the gate is Jonathan's product call). The old world's shared `mountain/**` edits (`waterArt.ts`) are in the live bundle, unverified by eye. Not pinned (PIN-1 open; device evidence owed).
