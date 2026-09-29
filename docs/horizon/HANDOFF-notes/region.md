# Pass 5 · T2 Region — notes

Track T2 of `passes/05-mountain-region.md`, 28 Sep 2026, working tree on `claude/horizon-v2-mountain` (not committed; the
integrator commits). Mountain v2 is placed on the Horizon by the one offset (`regions/mountainV2/placement.ts`, untouched).

## 1 · What was built

| File | What |
|---|---|
| `regions/mountainV2/index.ts` | `createMountainV2Region(options)` → `MountainV2Region` (the brief §2 interface plus `id`, `footprint`, `hidesTerrainCell`, `provider`, `mountSteps`), `regionDressing(theme)`, `mouthExclusion(mouths)`. |
| `regions/mountainV2/geography.ts` | `contains`, `groundAt`, `surface`, `ceiling`, `contact`, `blocked`, and the `provider` for `geography.addDynamic`. v2's own queries, native in / offset out. |
| `regions/mountainV2/ground.ts` | v2's ground lattice + paint (`buildLattice` / `groundMasks` / `paintGround`; never `createGround`), one mesh per tier. |
| `regions/mountainV2/scene.ts` | The stripped-down scene (§2 below), built as cooperative steps (`mountRegionSteps`, one v2 builder per step). |
| `regions/mountainV2/graph.ts` | `MOUNTAIN_PATH_GRAPH` in Horizon space as an `ExtraPathGraph` (ids `v2:*`), with the named seams. |
| `regions/mountainV2/rides.ts` | `rides` for T3: `lines`, `createRide` (v2's own, native), `curve` (Horizon space), `toHorizon(pose)`, `offset`. |
| `runtime/cards.ts` | `buildTerrainSteps` / `buildDistrictCardSteps` take a `TerrainCellFilter {skip?, split?}`; split cells go to `…​.under` tiles returned in `under`. |
| `runtime/geography.ts` | `DynamicGeography` gains optional `owns(x,z)` / `ground(x,z)`: an owning provider replaces the baked terrain as a `surface` candidate and answers `ground()` and the camera's terrain test. Static solids still count; `staticOnly` (hulls) ignores owners. |
| `runtime/index.ts` | Places, mounts, shows, hides and releases the region (§5); `api.mountainRegion`, `api.setMountainDamWater`, `stats().region`; CARD_CLOCK; audio; T3's `connectCableRegion`. |
| `world/pathGraph.ts` | `ExtraPathGraph`, `withExtraGraph(graph, extra)` (idempotent; polylines split per segment; seams + flush lips), `buildPathGraph(cuts, intersections, extraGraph?)`. |
| `world/definition.ts` | `RegionPlacement`, `WorldDefinition.regions?`. |
| `world/build.ts` | `buildRegions()` reads MANIFEST `regions` (T1 added the key: object offset/footprint; arrays also accepted), `createLandWorld` writes `regions` when present; `LandWorldOptions.extraGraph`. |
| `test/horizonMountainRegion.test.ts` | parity, decks, parapet, contains, provider ownership, hidden tiles, the seam probe (skips until the re-bake), walk graph across the seam, mount smoke in all dressings × tiers, rides. |

## 2 · Drawn / not drawn (D-M8)

**Drawn**: v2 ground and paint; routeArt (road with kerbs, parapets, retaining walls, stairs, Orchard Lane, gravel paths,
overlook platforms); bridgeArt (typed gorge bridges, funicular viaducts, path footbridges); waterArt with
`townFurniture:false` (river, foam, the town channel's water; no kerbs, culverts, footbridges); branchArt (skate branches:
routes with decks); rockArt (strata); damArt (structure, glass, reservoir water, Kitty chambers); transportArt (funicular
track and stations, gondola towers, ropes, terminals) + the funicular station huts (canopy, no goods) + both cabins parked at
station 0; the observatory; the goal pavilion as a plain shelter (no goal lamps, no sign); plantArt, instances kept only inside
`contains`; one bench per overlook where a placement stands within 16 m (only `bench:overlook:overlook:hearth` qualifies
today: 1 bench); the flock (full tier only, v2's bird and loop copied into `scene.ts`, no gates, bell, moths or butterflies).

**Not drawn**: townArt (square, storefronts, road-foot gate), the canal bridge (and its `town-race-road` deck is out of the
collision too), the monorail and its cabin, districtArt fixtures (and `district-art:*` solids are out of the collision),
propArt except `drawBench`, pennants/laundry, waterwheel, smoke, plot stakes/string, engraved plates and boards, wear fences,
gates, bell, moths, butterflies, the four tool buildings and the cottage, the Fund pulse.

**Additive v2 change** (the only one): `mountain/art/waterArt.ts buildWaterArt(b, pal, tier, options = {})` with
`WaterArtOptions {townFurniture?: boolean}`; omitted = v2's behaviour unchanged (`test/mountain-landscape.test.ts` green).

## 3 · Budget (CONTRACT §6) — over; the region is its own residency unit

Measured by the mount smoke test (jsdom, Classic; Taylor and Newfoundland mount too):

| Tier | Triangles | of which ground | of which planting | Draw calls |
|---|---|---|---|---|
| full | **478 969** | 72 619 | ~217 000 (tree outline shells ≈ 68 600 of it) | 121 |
| lite | **216 519** | 30 490 | ~65 200 | 92 |

Budget per streamed district: 150 k / 400 (full), 60 k / 180 (lite). The region is **3.2× / 3.6× a district's triangle
budget** (draw calls are well inside). It covers the area of about four districts (crown, lakeside, prow and hollow share its
footprint), so it is counted as **its own residency unit**: mounted when any district under its footprint is resident,
counted on its own line. v2's own full landscape is 250–560 k, so this is v2's quality as authored, not a leak. Cheapest
reductions if the integrator wants them (not done: they change v2's look): drop the full-tier tree outline shells (−69 k),
coarsen the lattice outside |x| < 90 (−~20 k), or use the lite planting on full beyond 150 m.

## 4 · Provider, `contains`, seam

`contains(hx, hz)` = inside `insideMountainV2` and not within 6 m of a Horizon terrain mouth (`mouthExclusion(cuts.mouths)`:
the Ore Line's South Portal keeps its opening) and:
- native −294 ≤ z < −48 (the massif): v2 ground > −0.2 or `mountainContains` (road/lane/branch over low ground);
- native z < −294 (north of the summit line, D-M2): v2 ground > −0.2 and v2 + 54 ≥ the Horizon's baked ground − 1 m (the Crown's
  higher north face stays the Horizon's); with no baked field (tests) native z ≥ −310;
- native z ≥ −48: the Foot terrace, r ≤ 66 round v2's square (terrace, lawn, channel). T1's Foot terrace holds the island level
  to r 84, so at r 66 v2's shore fall is 0.10 m under T1's level.

The provider (registered with `addDynamic`) **owns** the ground inside `contains`: `surface()` does not consider the baked
terrain there (so the gorge floor under a bridge is v2's, not the 5 m bake's), `ground()` and `cameraBlocked` read v2's
ground; decks come from `queryWorldSurface` over v2's surfaces (less the canal-bridge deck), ceilings from `worldCeilingAt`,
solids from v2's boxes (less district fixtures) and `EDGE_SOLIDS` (a solid blocks when it spans the body between step and head,
the Horizon's rule). Materials: v2 ground → `grass`; road, lane, stairs, promenade, metal platforms → `paved`; wood → `boardwalk`.
Ground hits keep the id `terrain` (board situations treat any other id as a step); decks are `mountainV2:<surface id>`.
Slope is converted to degrees (v2 reports a gradient).

**Hidden tiles and the seam**: I chose **split, not skip**. A resident district's terrain cell whose centre is inside
`contains` is built into separate `…​.under` tiles, visible only while the region is not drawn (so there is never a hole while
the region builds, rebuilds for a theme, or is released). Journey (coarse, 20 m) cells go under only when wholly inside. The
region's ground draws every lattice triangle with a corner inside `contains` or inside a hidden 5 m cell, so hidden cells are
always covered and the overlap at the edge is ≤ one Horizon cell (the bake is v2's own there). The seam probe
(8 edge points, |baked − region| ≤ 0.5 m) **skips** until the committed bake carries `world.regions` (T1's re-bake).

## 5 · Runtime mounting

- `mountHorizon` starts `placeHorizonRegions(assets, options)` alongside the entry chunks: a dynamic import of the region
  module, only when the definition lists `regions[].id === 'mountainV2'` (or `options.mountainV2 === true`, or `?mountainV2`
  in development; `?mountainV2=off` / `mountainV2: false` keep it out). No listing = no change to today's Horizon.
- `world.pathGraph = withExtraGraph(world.pathGraph, region.pathGraph())` at runtime start (walk plans, walk-outs, restores).
- Wanted = not the Journey map and a footprint district resident. Built with `createBuildTask(region.mountSteps(...))`,
  one step per frame (v2's builders are synchronous, so a step is one whole builder; the whole full mount took ≈3 s on this
  container the first time — the lattice and its masks are then cached per tier — and lite ≈1.2 s). Fog: every region material gets the runtime's `fogHook`, and fades in like a district. Released
  `REGION_RELEASE_MS` (20 s) after it stops being wanted; a theme change releases and rebuilds in the new dressing.
- Light rig and fog are the Horizon's; the region adds no light and never touches `scene.background` / `scene.fog`.
- `CARD_CLOCK.value = now/1000` in the runtime's tick while the region is placed and motion is ambient (calm / reduced
  motion hold it: no wind, still water sheen). The region never writes it. Note: this also starts the sheen on the Horizon's
  own water cards while the region is placed (they share the clock).
- Comfort: `setQuiet(!motion.ambientMotion)`: flock away, parked gondola still, dam water snaps.
- Audio: with the region placed and the body inside `region.contains`, `ambience.update` receives the body in v2's native
  space (the river, v2's paths and footsteps are right there); outside the footprint it hears the Horizon body as before
  (PR #566 CodeRabbit closed the 54 m "lower" wind). HorizonWorld is unchanged.
- `stats().region` = `{id, mounted, building, visible, districts, joins, triangles, drawCalls, groundTriangles, benches}`.

## 6 · The Fund picture (D-M3)

The region reads no money. The runtime exposes `api.setMountainDamWater(level, reserve)` (0…1; null = unknown: frosted glass)
and forwards it to the mounted scene's `setWater` (`setFund` is the same function under the brief's name). The runtime file
cannot name `fund` (the movers' money fence scans `runtime/index.ts`). **Not wired**: the Horizon does not read a
`BasinReading` today (only the manifest names L01), so `HorizonWorld.tsx` (not T2's) must call
`runtime.setMountainDamWater(...)` from the same reading L01 shows. Until then the dam shows frosted glass.

## 7 · What T3 needs (as built)

`region.offset`; `region.rides.lines[kind].stations[] = {id, name, at (platform, Horizon), yaw}`; `rides.createRide` = v2's
`body/ride.ts createRide` (native poses; `rides.toHorizon(pose)` or + offset); `rides.curve(kind, from, to)` = frames every
~2 m in Horizon space `{at, yaw, pitch, cabin}`. The runtime calls `connectCableRegion(placed.region, api.mountainRegion,
() => camera.aspect)` itself; `api.mountainRegion.setTransit(cabin | null, kind)` keeps the last transit and applies it
when the scene (re)mounts, so a ride during a rebuild still lands its cabin. T3's items 2–5 in `rides.md` are not done here.

## 8 · What T1 / the integrator should know

- **The seams before the re-bake**: road foot → nearest Horizon node is a 58 m `fallback` join today (V03 is not baked
  yet; it becomes a ≤ 6 m `seam` once V03 ends at v2's road foot `[1282, 54.65, 720]`). Summit: the overlook (9.5 m) and the
  observatory door (3.3 m) join the node at h 158 by the Crown walk; the quay joins a lake-shore node at 23.5 m. Joins steeper
  than 40° are never made. `test/horizonMountainRegion.test.ts` prints them.
- **The bake's journeys** do not see v2's graph unless `createLandWorld(…, {extraGraph})` gets it. The bake must not import
  v2's definition: dump `MOUNTAIN_PATH_GRAPH` (+ offset, `graph.ts`'s kind/surface mapping, `REGION_SEAMS`) into
  `land/mountainV2/v2-data.json` and pass it as `extraGraph` (same `v2:` ids; the runtime's merge is then a no-op).
- `crownLaunch` `[1305, 482]` h 170 stands 16 m south of v2's observatory (`[1306, 158, 466]`, r 4.7) and 12 m above the
  summit — check it against the observatory's dome and the summit gondola terminal (`[1298, 158, 482]`).
- The runtime's static import graph already contains v2's `definition.ts` (T3's `moverInput → movers/gondola → body/ride →
  body/geography`; and `HorizonWorld → mountain/audio.ts` before this pass), so v2's 1.2 MB ground is fetched at module
  evaluation on every Horizon load. The region's own dynamic import does not change that.
- v2's reservoir and river are not Horizon water bodies: a walker can stand on the reservoir floor under the drawn water.
  `waterLevel` needs a region hook (not built; see §9).

## 9 · Not finished / open

- The seam probe is written but skips (no `world.regions` in the committed bake); run it after T1's re-bake.
- Budget over (§3); no LOD for the region yet.
- No region water for the walker/boats (reservoir, river, channel).
- Planting season is fixed at mount (the month when the region mounts); a season change does not re-plant.
- No render proof: no browser here; the smoke test is headless (jsdom).
- `test/horizonMoversNoMoney.test.ts` fails on two lines that are not T2's: `movers/shared/vehicleArt.ts cameraMount`
  (another track's working-tree edit) and `movers/glider/index.ts Date.now/performance.now` (already on HEAD).
- `tsc`: clean for T2's files; the remaining errors are T1's in-progress `land/**` and `test/horizonLandforms.test.ts`.

## 10 · v2 defects seen (not hidden)

- `EDGE_SOLIDS` only collide north of native z −40 (`worldCollisionAt`'s `z < -40`), so any edge solid south of that line
  never stops a body; kept as v2 has it.
- `mountainProps()` places a bench at only one of v2's five overlooks (`overlook:hearth`); the other four have none within
  16 m, so the "one bench at each overlook" rule draws one.
- The road's bridge decks stand as little as ~1.3 m over the gorge floor in places (the highest is used by the deck test).

## Verification (this container)

`pnpm exec vitest run <file> --maxWorkers=1`, one at a time: `horizonMountainRegion` 10 passed / 1 skipped (seam, until the
re-bake); `horizonStreaming` 31; `horizonRuntimeGeometry` 7; `mountain-landscape` 4; `horizonWalkOut` 51; also
`horizonCards` 7, `horizonComfort` 4, `horizonRenderWork` 10, `horizonTerrainAsset` 7, `harbour-source-fences` 9 (they read
`runtime/index.ts` / call `cards.ts`). Fictional data only; no money read; no `src/core/` edit; nothing deleted in `mountain/**`.

## 11 · PR #566 Codex review (28 Sep 2026)

1. **Region load failure** (`runtime/index.ts placeHorizonRegions`): the import + `createMountainV2Region` are wrapped; a
   rejection (v2's terrain fetch/decode) logs one `console.warn` and resolves `null` — the Horizon mounts without the region.
   The loader is injectable (third argument) for the test.
2. **v2 data check in the gates**: `node scripts/horizon/dump-mountain-v2.mjs --check` (≈1.5–3.5 s, Vite SSR, no browser) runs
   in `pnpm build` (after the terrain bake check) and in `pnpm horizon:check`, which the `horizon-assets.yml` job runs; that
   workflow now also triggers on `src/harbour/mountain/**`.
3. **Region water** (§9's open item): `DynamicGeography.waterLevel?(x,z)`; `createHorizonGeography.waterLevel/submerged` read the
   owning provider first (baked `cuts.waters` still answer where it returns null). v2's water: the reservoir inside damArt's
   `reservoirOutline(RESERVOIR_LEVEL_MAX)` (the bowl, the rising shore, the dam's glass) over ground below the level →
   86 + 54 = 140; the river within `RIVER_HALF_WIDTH` of `RIVER` → the line's height. **Not followed**: a Fund reading that
   lowers the drawn reservoir (`setMountainDamWater`) — the collision stays at the full level; the town channel's culverts are
   covered by their slabs (a floor above the water wins).
4. **Blockers only while drawn**: the runtime registers `region.providerWhileDrawn(() => regionVisible)`: decks, solids and
   ceilings answer only while the scene is visible; `owns`, `ground`, `waterLevel` always (ground-only surface = v2's terrain,
   never the 5 m bake, so nothing falls through). **Could a body be left standing on nothing?** Yes without a hold — a body on
   a bridge or the dam crest during the first build, a theme rebuild, or Walk after the Island map outlasted the 20 s release.
   So inside the footprint the region counts as geometry that has not arrived: `gateOpen = chunkGateOpen && regionReady`, and
   `step()` sets `resnap` (held, no fall, no chute) until drawn, then re-seats within a step of the held height (never up onto
   a low deck overhead); restores and walk-outs into the footprint wait the same way; the status line says "still arriving".
   Riders (board, bicycle, flight) skip frames there until drawn (`riderReady`); a cable ride runs on its own line (its cabin
   transit is re-applied when the scene mounts) and its arrival onto a platform is held like a walker. The release itself
   (20 s after nothing under the footprint is resident) cannot strand anyone: a walker inside the footprint keeps it wanted.
5. See `rides.md` §3 item 3 (the cable buttons).
