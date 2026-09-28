# Pass 5 · T1 Land — notes

Track T1 of `passes/05-mountain-region.md`, 28 Sep 2026. This is a working tree on `claude/horizon-v2-mountain` and nothing
is committed; the integrator commits. Horizon space is v2 native + {x:1308, y:54, z:764} (`regions/mountainV2/placement.ts`,
untouched). Fictional data only. `src/core/` and money semantics were not touched.

## 0 · Status

- **Tests:** every owned suite is green on the committed bake, run one at a time with `--maxWorkers=1`.
  - Landforms 11, TerrainCuts 18, Beds 17, Structures 23, Water 11, Thresholds 8, Crossings 12, Views 11, Journeys 5.
  - WalkOut 51, HeldWalkOut 29, SavedPosition 4, Wave4 15, Wave6 9, Reconcile2 5, LandRepairs 10, Underground 4.
  - Manifest 35, BakeArtifacts 6, TerrainAsset 7, SkyEnvelope 5, Cards 7, HostsDoors 3, Reserves 1, Streaming 31.
  - WorldDefinition 3, SkateLines 5 (+2 todo).
- **Byte-exact check:** `pnpm horizon:check` passes (terrain sha256 `ebdb37fc5da1b9a1c341092ac0cd7901adb7a76d863c19b2e3a11f7ac25777ce`).
- **v2 data:** `node scripts/horizon/dump-mountain-v2.mjs --check` passes.
- **tsc:** run once at the end. It reported 3 unused-symbol errors, all in T1 files, and all three are fixed:
  - `beds/build.ts` `evenClimb`, which was retired with V02;
  - `beds/junctions.ts` `maxGrade` import;
  - `horizonLandforms.test.ts` `dx`.

  After those fixes tsc was not re-run over the repo. Landforms and Beds were re-run instead, and both are green.
- **T2's `test/horizonMountainRegion.test.ts`:** run for information only. It passes 10 of 11 tests. The seam test fails; see §6.

## 1 · New and changed files (T1)

| File | What |
|---|---|
| `scripts/horizon/dump-mountain-v2.mjs` (new) | Uses Vite SSR to dump v2's authored geometry into Horizon space. Pass `--check` to compare against the checked-in file. |
| `land/mountainV2/v2-data.json` (new, generated, 44 KB) | v2's road and course data in Horizon space:<br>• road samples (every 3rd sample, 315 in all), course (391 points, 17 gates, finish, segments)<br>• gondola stations and towers, funicular stations<br>• dam (promenade, arc, apron, Kitty chambers, reservoir), river<br>• observatory, pavilion, sites, plots, terraces |
| `land/mountainV2/ground.ts` (new) | The D-M2 rule: `mountainV2Rule` and `mountainV2Height`.<br>v2's ground asset is decoded in Node only; the browser gets `null`. |
| `land/mountainV2/beds.ts` (new) | Beds that ride v2's own geometry:<br>• `mountainV2.road`, the promenade walk, `mountainV2RoadFootway`, `onMountainV2Road`<br>• `regionCarry` / `regionCarryLand`: no Horizon cut, deck, kerb or wall on v2 land |
| `land/mountainV2/README.md` (new) | How `v2-data.json` is regenerated. |
| `land/terrain/index.ts` | • `baseHeight` applies `mountainV2Height` after the Stillwater sill.<br>• The Notch uses the `NOTCH_HEAD` constant (the dam is gone).<br>• `applyWaters` holds the lake lip at 50 at the outlet.<br>• The de-spike and band probe skip v2 land. |
| `land/water/index.ts` | • Cup and `river.upper` removed.<br>• `river.lower` starts at the sill (50) and falls to 22.<br>• New brook `water.river.mountain`. |
| `land/beds/build.ts` | • V03 added; `mountainV2.road` and the promenade are carried.<br>• S1 on v2's course (`s1OnMountain`).<br>• The Year Walk and the Crown walk run on v2's road; the regrade skips on-road segments.<br>• G1 is authored from v2 (towers, hang, sag, throat 30, `drawnBy` mountainV2).<br>• `roadTunnels()` is exported, and manifest tunnels are generic.<br>• A lane inside a v2.6 tunnel keeps the tunnel's cover circle (see §5). |
| `land/beds/junctions.ts` | `alignSurfaceJoins` ignores segments that lie on v2's road when it checks the 12 % grade. |
| `land/structures/build.ts` | • `manifestTunnels()`.<br>• The dam, apron, gallery, L01 slab reseat and dam portage are removed.<br>• The inlet footbridge is conditional.<br>• G1 platforms and head frames are skipped when the region draws them. |
| `land/town/build.ts` | • `walk summit` is re-laid and carried.<br>• New `walk summitStation`, from the gondola top platform to L02.<br>• L01 is a deck bay with a plaque; the slab is removed. |
| `land/underground/build.ts` | • ORE uses `heights_v2_6`.<br>• The south portal is at 67.5, and its link is carried to v2's road. |
| `land/structures/groundBeds.ts` | Unchanged; it is identical to HEAD. |
| `world/MANIFEST.json` | v2.6 (§2). |
| `public/horizon/**` | Re-baked. |
| Tests | Updated only where a ruling changed the number. Each changed expectation carries a `v2.6` comment. |

## 2 · Manifest edit table (v2.5 → v2.6)

Every removed row is kept verbatim under `retired_v2_6.<path>`. Every re-posed row keeps its old value as `v2_5`
(`v2_5_xy`, `v2_5_pts`, …). **T4:** mirror this table into `docs/horizon/make_manifest.py`.

The file format is `json.dumps(m, indent=1)` + `"\n"`, ASCII-escaped.

| Key | Old | New | Why |
|---|---|---|---|
| `version` | 2.5 | 2.6 | Pass 5 |
| `regions` (new top-level) | — | `[{id:mountainV2, kind:placedWorld, offset, footprint {1108..1508 × 368..848}, source, ground, data, decisions D-M1..D-M10, summitNote}]` | D-M1/D-M2. `parseHorizonManifest` ignores extra keys; T2's `buildRegions` reads it |
| `roads.V02` | present | retired | D-M4: Crown Road is retired, and v2's road is the mountain road |
| `roads.V03` | — | Mountain Road from V01 [1599.5,790.8] to the v2 town lane at [1281.5,742], ≤ 10 %, 327 m<br>levels: 45 at the east portal, 52.3 at the west portal, 53.8 at the terrace edge, 56.0 at the canal bridge, 55.3 at the end | D-M4 |
| `structures.shoulderTunnel` | present | retired | D-M4 |
| `structures.dam` | present | retired | D-M3: Stillwater drains over a natural rock sill |
| `structures.lakesideSwitchback` | present | retired | D-M5 |
| `structures.s1Flyover` | present | retired | D-M5 |
| `structures.crownWalkBridge` | present | retired | D-M4/D-M5 |
| `structures.inletFootbridge` | present | retired | D-M3/D-M5 (the inlet it crossed is v2 ground) |
| `structures.gondolaStations` | base [1480,1090], crown [1335,535] | v2 platforms [1279.71,810.73] h 54.53 and [1298.3,481.7] h 158.05, `drawnBy` mountainV2 | D-M6 |
| `structures.mountainRoadTunnel` | — | tunnel [1441.5,789.5], 73 m on V03, width 17 | D-M4 |
| `structures.mountainRoadCanalBridge` | — | V03 over v2's town channel at [1300.5,748], span 18, width 17 | D-M4. The span is 18 so the deck covers the Year Walk share, which is carried within span/2 + 2 of the centre |
| `structures.s1InflowBridge`, `structures.inflowFootbridge` | — | S1 and walk lakerim over `water.river.mountain` | D-M3 |
| `structures.southPortal` / `underground.doors.southPortal.h` | 110 | 67.5 | D-M7 |
| `underground.damGallery` | present | retired | D-M3 |
| `water.cup`, `water.river.upper`, `water.dam` | present | retired | D-M3/D-M5 |
| `water.river.mountain` | — | brook [1317,833] 53.9 → [1300,838] 51.2 → [1270,836.5] 50 → [1232,832] 50, width 5 | D-M3. It is laid as its own channel because the lake lies between it and `river.lower` (brief: "river.lower gains the continuation") |
| `water.river.sill` | — | lip [1136,896] at level 50, the head of `river.lower` | D-M3 |
| `places.L01` | [1173,912] h 52 | [1316,539.2] h 142 (exact `DAM_PARTS.promenade[6]`; the brief's ≈514 was the dam centre) | D-M3 |
| `neighbourhoods` | L01 in lakeside | L01 in crown | D-M3 |
| `skate.S1.pts` | 17 controls | 143: v2 course (131, every 3rd point) plus 12 Horizon points from the quay finish to the Landing | D-M5 |
| `skate.S1.segments` | 6 | 13: v2's 9 (`MOUNTAIN_RACE_SEGMENTS`) + Sill, Notch shelf, Reach boardwalk, Quay finish; each has a `start` | D-M5 |
| `skate.S1.length_m` | 971 | 1712 in the manifest (1721 on the built line) | D-M5 |
| `skate.S1.mountainV2` | — | `{upperPts, gates}`: the 17 gates are v2's | D-M5 |
| `cable.G1` | [1480,1090] 18 → [1335,535] 150, solved towers | [1282,810] 54.53 → [1300,480] 158.05<br>• towers [1250,710], [1228,614], [1370,550] with authored tops 100 / 128 / 158<br>• `hang_eu` 3.1, `sag_pct` 3.2, `throat_m` 30, `drawnBy` mountainV2, length 474 | D-M6. The throat is 30 because v2's rope is 7.5 eu over the Foot lawn at 26 m |
| `rail.ORE` | portal 110, controls 57 / 96 | `heights_v2_6` [40,42,68,68,40,50,62,67.5] | D-M7 |
| `journey.yearWalk.pts` | 295 controls, Jan station [1330,640] | 326 controls | D-M4/D-M5 |
| `journey.stations.jan` / `pins.jan` | [1330,640] h 112.8 | [1364,650] h 73.2, "Hearth Terrace (the mountain)" | D-M5 |
| `journey.yearWalk.shares` | jan on V01 + V02; feb on lakerim | • jan: V01 → V03 (south, 6.5, through the tunnel) → `mountainV2.road` (left 2.4) to s 228.8<br>• feb: `mountainV2.road` (right 2.4) down → the Foot → the lakerim spline from [1219.3,745.4] | D-M4/D-M5 |
| `journey.yearWalk.levels` | forecourt [1350,687] h 110 | [] | D-M4/D-M7 |
| `journey.yearWalk.ownTrails.feb` | Lakeside zig-zag | "the Foot lane" | D-M5 |
| `journey.yearWalk.s1Crossing` | [1267,842] | null | D-M5 |
| `walks.crown` | own bed | `footwayOf {host mountainV2.road, 2.4, left, from_s 228.81, to_s 945.86}`, joins the Year Walk at [1359.5,661.64] h 73.29 | D-M5 |
| `walks.crownFromGondola` | present | retired | D-M6 |
| `walks.footQuay` | — | [1281.5,742] → [1276,760] → [1279,785] → [1283,800] → [1282,810] | D-M6: the quay platform joins the Horizon graph |
| `thresholds.gondolaBase` / `gondolaTop` | [1480,1090] / [1335,535] | [1279.71,810.73] / [1298.3,481.7] | D-M6 |
| `thresholds.skateLineStarts[0]` | [1310,500] | [1325,470.5] (v2's start gate) | D-M5 |
| `thresholds.damPortage` | present | retired | D-M3 |
| `pastimeData.sledding` | bed on the Shoulder SE meadow | v2's meadow terraces, no Horizon bed | D-M5 |
| `crossings` | 266 rows | 224 rows: 46 retired (under `retired_v2_6.crossings`), plus new rows below | D-M3..D-M6 |
| New crossing rows | — | • S1 × `water.river.mountain` (over) and walk lakerim × `water.river.mountain` (over)<br>• walk footQuay × G1 and walk summitStation × G1 (threshold, modeTransfer) | D-M3/D-M6 |
| `views.A` | subjects High Span, dam face, Shoulder | subjects High Span, Shoulder; portrait frames High Span. Eye, target and lens unchanged | D-M10 |
| `views.F` | eye [1158,905], target [1400,1150] | eye = promenade[12] [1337.86,526.54] h 143.6; ground L01; target [1119,731] h 101.4; subjects L01, Stillwater; portrait fov 45, target [1150,760] | D-M10 |
| `views.E`, `views.G` | — | unchanged (both pass landscape and portrait on the new bake) | D-M10 "only as far as the ground requires" |
| `journeys` | S1 targets [110,150]; summit legs 158/574/70, target 205 | • S1: 1721 m, measured 172.1 s, target [150,200]<br>• summit: legs ≈830 / 474 / 14, measured 420.6 s, target 465 (pending D-M6b) | D-M5/D-M6 |
| Notes | — | `pastimeData` RIVER_RUN note (no portage now) and the `regions[0].summitNote` (see §7) | — |

## 3 · Bake numbers

| | v2.5 (HEAD) | v2.6 |
|---|---|---|
| terrain sha256 | `4defdafc…cd09f1b` | `ebdb37fc…25777ce` |
| terrain bytes | 571191 | 571191 |
| definition bytes (gz) | — | 27220481 (6139889) |
| collision beds | 128 | 121 |
| solids | 1150 | 1057 |
| diagnostics | 312 | 340 |
| **conflicts** | **140** | **131** |
| bake time | — | about 119 s |

**Conflicts resolved (12):**
- `cross.s1.damApronLevel.1`, `cross.s1.damPortage.2`, and their junction twins (the dam is retired)
- `structures.terrainBedFill.residual.39–43`
- `gradeStretch.yearWalk.10793`
- `view.A`

**Conflicts new (3):** all three are the same class as the existing `walk crown × stepsPortage` conflicts. In each, a surface route sits about 133 eu over the underground stair `stepsPortage`:
- `cross.mountainV2Road.stepsPortage.1` [1388.2,487.8]
- `cross.mountainV2Road.stepsPortage.2` [1362.3,473.8]
- `cross.s1.stepsPortage.2` [1388.2,487.8]

**Within 60 m of the footprint:** 20 conflicts remain. Apart from the 3 new ones above, all were in v2.5 and none is caused by the ground override:
- the ORE grade stretches
- `threshold.adit.pit`
- the DEEP_RUN / ORE / throat / deepAccess registered thresholds
- `walk crown` / `walk summit` × `stepsPortage`

**Outside the footprint:** the v2.5 conflicts are unchanged. Phone-portrait failures on views C, D and L predate this pass.

**Terrain outside the footprint and its 60 m band** is identical to v2.5 except 532 vertices, all explained. That count was measured before the §5 tunnel fix, which only restores cover inside the footprint band:
- the V03 corridor
- the Year Walk lanes that moved with the shares
- the Notch/sill outlet

## 4 · Seam probes (the footprint edge)

**§4.1: footprint corners and edge midpoints** (bake field in Horizon space; "v2" = v2's ground + 54):

| Probe | Point | Bake | v2 | Rule |
|---|---|---|---|---|
| N edge | [1300,368] | 134.37 | 50.5 | apron, north: the Crown wins |
| NE corner | [1508,368] | −1.47 | 45 | outside |
| E edge | [1508,600] | 96.20 | 50.5 | apron |
| SE corner | [1508,848] | 26.07 | — | outside |
| S edge | [1308,848] | 53.35 | 53.95 | island (Foot terrace) |
| SW corner | [1108,848] | 45.00 | — | outside |
| W edge | [1108,600] | 97.18 | 50.5 | apron |
| NW corner | [1108,368] | 104.91 | 45 | outside |

**§4.2: at v2's own shoreline**, where T2's `contains` begins, as measured by T2's seam test on this bake:

| Probe (start, step) | \|bake − region\| |
|---|---|
| [1108,500] +x | **3.30** |
| [1108,700] +x | 0.18 |
| [1508,500] −x | **2.65** |
| [1508,700] −x | 0.00 |
| [1200,368] +z | 0.02 |
| [1350,368] +z | 0.05 |
| [1260,848] −z | 0.00 |
| [1340,848] −z | 0.05 |

The two large gaps are 5 m lattice interpolation on v2's own steep shore. For example, at z 500 v2 rises 54 → 65 between x 1145 and x 1150, and it is convex there.

- At lattice vertices the bake equals v2: 3004 of 3033 v2-land vertices are within 5 cm.
- `baseHeight` equals v2 exactly on land.

No Horizon lattice can close this gap. It is T2's to handle, for example by:
- probing at lattice vertices, or
- a tolerance scaled by slope, or
- a region skirt.

**§4.3: D-M2 north checks.**
- Throat mouth [1300,300]: 131
- Throat jambs: 131 and 130.88
- Skylight top [1320,400]: 138.00
- Saddle [1300,400]: 140.65
- Crown summit [1310,470]: 157.96

## 5 · Fixes made after the first full run (for the integrator's diff reading)

- **The tunnel trench.**
  - The Year Walk January lane runs through the Mountain Road Tunnel at 6.5 m.
  - It kept only its own 4.8 eu section circles, so its 15 eu blend cut a trench to lane grade down the hill over the tube (98 → 52 eu on the road axis).
  - Fix, in `settleYearWalkShares`: a lane inside a v2.6 manifest tunnel receives the tunnel's own cover circle.
  - The cover is now intact: the bake equals `baseHeight` from x 1405 to 1430 on the road line.
- **The canal bridge gap.**
  - The Year Walk share on V03 is carried within span/2 + 2 of the bridge centre, but the deck reaches only span/2.
  - This left a 1.3 m gap where the walker dropped 0.7 eu.
  - Fix: `span_m` 12 → 18.
- **The sill-lip test** now skips 10 eu around the outlet channel (its 6 eu half-width plus the 4 eu bank), up from 8. The weir falls 28 eu there, so the channel's own bank falls with it.

## 6 · Facts other tracks need

**T2 Region**
- **`world.regions`** is in the bake (`createLandWorld` writes it): `[{id:'mountainV2', kind:'placedWorld', offset, footprint}]`.
- **Ground ownership** (`mountainV2Rule(hx,hz).kind`):

  | Kind | Where | Ground |
  |---|---|---|
  | `land` | v2's massif | the bake equals v2 |
  | `island` | native z > −48, r ≤ 84 | Foot terrace 53.95 plus the lawn hump |
  | `foot` | `MOUNTAIN_V2_FOOT_PLAIN` polygon | Horizon-drawn at 53.95 |
  | `apron` | v2 sea within 40 m of land | 53.95 → Horizon |
  | `outside` | elsewhere | the Horizon's |

  Only `land` is v2's ground. North of native z −294, the higher of v2 and the Horizon wins. The Crown wins the whole north face, and v2 wins the summit crest.
- **Horizon beds carried on v2 land** emit no deck, kerb or wall. The region must answer ground and decks there:
  - `mountainV2.road`
  - `walk mountainV2.promenade`
  - S1's upper course
  - `walk crown`
  - `walk summit`
  - `walk summitStation`
  - the Year Walk lanes on v2's road
  - the south-portal link
- **Seam joins** used by the Horizon graph:
  - the road foot [1282,54.65,720]
  - the V03 end [1281.5,55.3,742], on v2's town lane
  - the gondola Waterfront threshold [1279.71,54.53,810.73]
  - Summit Commons [1298.3,158.05,481.7] → L02 [1310,158,470]
  - the promenade east end → v2's road at the dam overlook
- **The canal bridge conflicts.** T2 does not draw v2's canal bridge (its `town-race-road` deck). The Horizon's `mountainRoadCanalBridge` (V03, [1300.5,748], span 18 × 17) now owns that crossing. Check that the two do not both draw.

**T3 Rides**
- **G1 (manifest `cable.G1` plus `structures.gondolaStations`):**
  - Waterfront platform [1279.71,54.53,810.73]; Summit Commons [1298.3,158.05,481.7]; line anchors [1282,810] → [1300,480].
  - Towers [1250,710] top 100, [1228,614] top 128, [1370,550] top 158.
  - Rope = cabin path + `hang_eu` 3.1; sag 3.2 %; throat 30 m; length 474.
  - The Horizon draws no G1 towers or terminals, only tower footings (support solids) and the rope bed.
- **Funicular stations** (v2-data): town [1288.5,55.65,728], hearth [1313,69.6,675], library [1328,93.6,608], reservoir [1347,141.6,538].
- **S1:**
  - The course finish is at [1328.48,54.72,801.97], and the start gate at [1325,470.5].
  - The v2 course is exact in `skate.S1.mountainV2.upperPts`.
  - The segments' `start` values mark where each segment begins.

**T4 Deck and Journey**
- Mirror §2 into `make_manifest.py`.
- `world/views.ts` `PAGE_SUBJECTS` for A and F is stale. The manifest `subjects` override it (see `views.ts`), but the integrator should align it. This is outside T1's folders.
- Journey summit target is 465 s against a measured 420.6 s (square → V03 → footQuay → G1 → summitStation). D-M6b is not built.

## 7 · Deviations and decisions for Jonathan to confirm

1. **Summit height.**
   - v2's crest is 163.24 at [1297,452], 5.2 above `landforms.crown.summitH` 158.
   - D-M2's "higher of the two" north of native z −294 makes it v2's, so "the Crown summit stays the island high point" is impossible as written.
   - L02 and the observatory stay at 158. The Landforms test now asserts ≤ 163.25 within 40 m of [1300,455].
   - `regions[0].summitNote` records this.
2. **Year Walk lanes on v2's road are at 2.4 m, not the brief's 5 m.** v2's road half-width is 4.8, and its kerbs, parapets and walls stand at the edge. The lanes stop at s 228.8 (h 73.29), where the station detour is flat. `walks.crown` continues from there on the left side.
3. **V03 route.**
   - It leaves V01 at [1599.5,790.8], north of the Terraces lay-bys.
   - It tunnels 73 m under the Shoulder remnant (ridge 93–99 over a road at 45–52).
   - It ends on v2's town lane at [1281.5,742], 22 m south of the road foot. The funicular town station and its viaduct stand east of the foot, and the lane carries wheels on.
4. **The Foot plain** (`MOUNTAIN_V2_FOOT_PLAIN`, Horizon-drawn at 53.95) lowers the Shoulder's south-east rim there.
5. **`water.river.mountain`** is a separate brook into Stillwater's east shore, not an extension of `river.lower`: the lake lies between the two. Stillwater drains over the sill into `river.lower`.
6. **The F re-pose** puts the eye on v2's promenade (east end) and looks over L01 to Stillwater. A drops the dam face as a subject; the Crown's face is past the fog.
7. **The south portal (D-M7)** stands at 67.5 on v2's road switchback. Its link is carried to the nearest road point.
8. **crownLaunch** is unchanged. Its lookout deck columns likely collide with v2's summit gondola terminal around (1300,479); T2 or T3 should check by eye. The observatory is clear.
9. **River Run has no portage** now that the dam is gone. **The inlet footbridge is retired.**
10. **G1's throat is 30 m**, not the code default of 25, because v2's rope leaves the Waterfront platform low over the Foot lawn.
11. **L01 is at promenade[6] exactly**: [1316,142,539.2]. The brief's ≈514 was the dam centre.

## 8 · Open / unfinished

- **The `stepsPortage` class.**
  - These conflicts are `mountainV2.road` ×2, S1 ×1, `walk crown` ×2 and `walk summit` ×1, each over the underground stair (`land/underground/build.ts:144`), raised by `world/build.ts:88`.
  - The retired register rows for walk crown and walk summit were at their v2.5 positions. Nothing new is registered, so these conflicts are "proposed".
  - Decision for the design lead: register them as `over` (rock between, about 130 eu) or teach the prover that rock is the structure.
- **`OPEN_VOIDS`** (`land/structures/groundBeds.ts:96-112`) still lists v2.5 Crown Road items at [1384.8,687.9], [1461.6,698.8] and [1448.5,376.2]. They are harmless because nothing now fails near them, but they are stale. Prune them in a later land pass, after a residual listing.
- **T2's seam test** fails at 2 of 8 probes (§4.2). T2 owns it, and the Horizon lattice cannot close it.
- **tsc** was run once. The 3 unused-symbol fixes after it were verified only by re-running Landforms and Beds.
- **D-M6b** (Little Harbour → v2 quay lower leg) is not built, as the brief requires.
