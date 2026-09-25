# Pass 1 — The land (terraforming)

Builder: **Codex**. Reviewer: **Claude**, by `REVIEW-BRIEF.md` (five auditors, probes, renders, live playthrough). Gate: **Jonathan, by eye**, on the renders, before any line, plant or prop goes on the land. Delivery: `~/Downloads/hearth-horizon-p1-land/`.

---

## Purpose

Make the Horizon's ground: one continuous, asymmetric heightfield with its water, coasts and offshore rocks; every bed cut to its profile; every structure standing as real (greybox) geometry with an underside; every crossing resolved; every threshold placed; the reserve pads graded, walled and served; the seven hosts as greybox volumes on aprons with working doors; the Undercroft's volumes; the flight envelope; the twelve Sketchbook poses; the whole thing as WorldDefinition v3 data with a baked terrain asset and streaming districts. **No planting, no props, no dressing.**

This is the pass Mountain v2 got wrong (`inputs/mountain-dissection-summary.md`). The land is judged from the twelve pages with nothing on it.

## Inputs

| Input | Keys / sections |
|---|---|
| `CONTRACT.md` | all; §2 (hard rules), §3 (coordinates, scale), §4 (WorldDefinition v3), §5 (reserves), §6 (budget), §7 (acceptance) |
| `MANIFEST.json` | `extent`, `island`, `offshore`, `landforms`, `protected`, `water`, `hosts`, `places`, `profiles`, `surfaces`, `roads`, `skate`, `walks`, `cable`, `rail`, `water_routes`, `structures`, `underground`, `sky`, `reserves`, `neighbourhoods`, `views`, `crossings`, `thresholds`, `journeys`, `speeds_ms`, `scale` |
| `LIGHT.md` | §1 (solar position, `?sun=`, readable night), **§2 (the terrain faces the sun)** |
| `STYLE.md` | §0.3 (units: m vs eu), §1.2 (one sun, sun-facing terrain rule 9), §1.4.1 rules 1, 9 (clearings, strata), §1.5 (surface ids), §1.6 (structures), §1.7 (water), §1.8 (sky gradient, fog, horizon cards), §1.12 (the twelve pages), §1.13 (LOD, streaming), §1.14, §3.3 (strata sets) |
| `NOT-THIS.md` | all |
| `docs/DECISIONS.md` | D12 (reserve locations) and D13 (`scale.factor`) **answered**; pass 1 does not start otherwise |
| Mountain v2 at `PIN-0` | contracts to keep: `surfaces.ts` queries, `streaming.ts`, `pathGraph.ts` algorithm, `body/geography.ts`, `camera/{worldAdapter,obstruction}.ts`, `lightRig.ts`, `scene/groundPaint.ts`, `art/{cardKit,cardScene}.ts` |

Preconditions: `PIN-0` exists; D12 and D13 answered; the manifest at `src/harbour/horizon/world/MANIFEST.json` carries `scale.factor` and is the version (1.1 or later) in which the design lead has closed the open manifest issues raised with this deck on 25 September 2026. If the loader's `requireScaleFactor()` throws, stop.

## Base SHA rule

- Branch `codex/horizon-land` from `PIN-0`. No rebase during the pass.
- If `main` moves, the integrator rebases once, before handoff, and re-runs every suite and every capture.
- `GEOGRAPHY_REVISION = 'horizon-geo-1'` for the whole pass; the presence `world` string becomes `horizon:horizon-geo-1` (browser and Worker together, Codex trust review).
- The Horizon mounts behind a dev-only flag (`world=horizon` on the review harness). Production keeps Mountain v2 until Jonathan decides the switch.

## Coordinates, scale, units

- Concept metres from the manifest × `scale.factor` = engine units, on x, y and height alike (`CONTRACT §3`). North is −z.
- Object dimensions in `STYLE` are in eu and never scaled (`STYLE §0.3`): deck thickness 0.6 eu, kerb 0.15 × 0.25 eu, parapet 1.0 eu + 0.15 eu coping, handrail 1.05 eu, piers every 12 eu, footings ≥ 0.2 eu into ground.
- Where a scaled manifest clearance (road `clear_m`, rail `tunnel_clear_m`, cable `clear_m`, cave `clear_m`) is smaller than the eu object that must pass through it (body `BODY_HEIGHT = 1.25 eu`, cart with seated riders, cabin, plane wing), build to the larger and list it in `HANDOFF.md → Conflicts`.
- The walkable-slope limit is Mountain v2's (`surfaces.ts`); report its value. Every face steeper than it is non-walkable, reads as rock with strata (`STYLE §3.3`), and is never climbable.

## Tracks

Three tracks run in parallel, then integration. The integrator creates `src/harbour/horizon/land/interfaces.ts` on the first commit (`BedCut`, `PadCut`, `MouthMask`, `WaterCut`, `StructureSolid`, `DistrictBounds`); tracks only read it.

### Track A — terrain, water, coasts, offshore, sun

| Owns | Must not touch |
|---|---|
| `src/harbour/horizon/land/terrain/**` (the heightfield solver: landform bands, blending, strata faces, applying B's cuts and masks) | `land/beds/**`, `land/structures/**`, `land/underground/**`, `land/reserves/**`, `land/town/**` (Track B) |
| `src/harbour/horizon/land/water/**` (sea, shallows, Stillwater, the Cup, river upper/lower, Orchard Brook, the Wash, Reach channels, the Deep's surface) | `src/harbour/horizon/world/**` (Track C) |
| `src/harbour/horizon/land/coast/**` (outline spline, 12 m shore stroke, 50 m shallows, cliff faces) | the seam files (integrator) |
| `src/harbour/horizon/land/offshore/**` (the Lamp, the Needle's Eye arch, the Stacks, the Wreck, the Bight sandbar) | `src/core/**` |
| `src/harbour/horizon/sun/solar.ts` (pure solar position at 44° N from date, time and time-zone meridian, `LIGHT §1`) and the dev-only `?sun=HH:MM` and `?date=YYYY-MM-DD` overrides (`LIGHT §1` ownership: pass 1 builds both) | |
| `src/harbour/horizon/sky/{gradient,fog,horizonCards}.ts` (Classic day and night gradient by sun elevation, fog table, greybox horizon cards ≤ 300 triangles, `STYLE §1.8`) | |
| `scripts/horizon/{slope-map,sun-map}.mjs` | |

### Track B — beds, town slope, structures, reserve pads, cave volumes

| Owns | Must not touch |
|---|---|
| `src/harbour/horizon/land/beds/**` (bed splines from `roads`, `skate`, `walks`, `rail`; profile cross-sections; kerbs, shoulders, parapets, retaining walls; surface ids per segment; `BedCut` data for Track A) | `land/terrain/**`, `land/water/**`, `land/coast/**`, `land/offshore/**` |
| `src/harbour/horizon/land/structures/**` (every `MANIFEST.structures` item and every crossing structure as greybox solids with thickness, supports and undersides) | `src/harbour/horizon/world/**` |
| `src/harbour/horizon/land/town/**` (Little Harbour's four tiers: upper street, square, storefront lane, quay; the market stair and its ramp twin) | the seam files |
| `src/harbour/horizon/land/reserves/**` (eight plot pads, two small reserves, walls, lay-bys, aprons, `PadCut` data) | `src/core/**` |
| `src/harbour/horizon/land/underground/**` (the Undercroft's rooms inside `underground.footprint`, the Ore Line tunnel to the South Portal, the Throat (a sloping diving entry) and the skylight shaft, the Deep's cavern, the Sea Passage (the Deep Run's boat tunnel to the Sea Door), the sealed drift; `MouthMask` data for Track A). The Dam Gallery stair is part of the dam (`structures/**`); it does not enter the Undercroft | |

### Track C — WorldDefinition v3 data, districts, sky envelope, hosts, baked asset

| Owns | Must not touch |
|---|---|
| `src/harbour/horizon/world/build.ts` (MANIFEST + track outputs → one `WorldDefinition`) | `land/**` except `land/hosts/**` |
| `src/harbour/horizon/world/{districts,views,thresholds,crossings,pathGraph}.ts`, `src/harbour/horizon/world/lights/land.ts` (door and threshold lamp anchors for night readability) | the seam files |
| `src/harbour/horizon/sky/envelope.ts` (ceiling, launches, lift fields, sink, landing fields, the twelve gates as volumes) | `src/core/**` |
| `src/harbour/horizon/land/hosts/**` (seven greybox host volumes at the masters' footprints; aprons facing `hosts[*].door`; door anchors; arrival thresholds) | `src/harbour/village/layout.ts`, `src/harbour/data/reading.ts` |
| `scripts/horizon/bake-terrain.mjs` → `public/horizon/terrain/horizon-geo-1.bin`; the async loader | |
| `src/harbour/horizon/world/streamingAdapter.ts` (districts → Mountain v2 `streaming.ts`) | |

### Integration (the Codex integrator)

| Owns | Does |
|---|---|
| `src/harbour/horizon/land/interfaces.ts` | creates it on commit 1 |
| `src/harbour/scene/runtime.ts`, `src/harbour/HarbourWorld.tsx` | mounts the Horizon behind `world=horizon` |
| Mountain v2 `surfaces.ts` | extends the surface query to the `MANIFEST.surfaces` ids; keeps the v2 contract |
| Mountain v2 `camera/worldAdapter.ts` | reads the v3 definition; Sketchbook poses as named shots (`__harbour.shot('A')` … `shot('L')`) |
| `src/house/navigation.ts` | saved body positions carry `geo: 'horizon-geo-1'`; mismatch → nearest path node |
| `src/ledgerSync/worldPresenceWire.ts`, `workers/ledgerRoom.ts` | presence `world` = `horizon:horizon-geo-1`; **Codex trust review** |
| evidence | runs captures, probes, maps, timings; packages delivery |

## Must produce

Every row names its manifest key. "Greybox" means untextured card solids with true thickness, supports and undersides; it never means floating, zero-thickness or ribbon.

### Terrain, water, coast (Track A)

- [ ] One continuous heightfield over `extent` at `scale.factor`; no seams, no cones, no discs, no sine ripple, no trenches.
- [ ] Every `landforms[*]` height band `h` respected over at least 90 % of its polygon; applied per `MANIFEST.json → landformRule`: polygons clipped to the island outline; the Hollow, the Stillwater terrace and the Cup cut into the Shoulder (`landforms.shoulder.cutInto`: their own band wins inside them); elsewhere the innermost, higher band wins; band edges blend over 60 m; every bed overrides the bands within its profile width + 15 m each side and holds its own grade limits, so no band step shows as a cliff on a route.
- [ ] Every landform **asymmetric**: the distance from its centroid to its mid-band contour varies by ≥ 25 % around the compass (deck-set threshold); no concentric rings, no equal-height steps between neighbouring landforms.
- [ ] The Crown off-centre with its summit at `landforms.crown.summit` and the highest point of the island there; not sheared by any edge fade.
- [ ] Faces per `landforms[*].faces` and `LIGHT §2`: the Prow's sea cliffs face east; the Flats face west; the Hollow is a south-facing bowl; Scholars' Edge a north-west rise; Long Sands runs east–west; the Throat's face is north and in shade all day.
- [ ] Every cliff above the walkable limit carries its `STYLE §3.3` strata set.
- [ ] The Notch carved along `landforms.notch.centreline`, `width` 40–70 m, 25–45 m below the terrace, strata walls, with `water.river.lower` on its bed.
- [ ] The dam stands proud: its south face shows the full Notch depth to the square; crest above `water.stillwater.surface`; no pit, no land bridge through the basin, nothing inside the basin.
- [ ] Stillwater, the Cup (its outflow to the lake is a 62 % cascade, scenery only), the river (upper and lower, the mouth reaching the sea at `[1364,1390]` past the Quay Bridge), Orchard Brook, the Wash (dry bed), the two Reach channels, the Deep: every water surface sits in its bed, below its banks at every sample, and descends monotonically downstream.
- [ ] The Bight a real lagoon inside the hook, sea level, with its mouth spanned by the Bight Bridge (`structures.bightBridge.span_m` 230, `clear_m` 8; the control points give ≈ 245 m of water), the sandbar at `offshore.sandbar` just below sea level (shows at full moon later).
- [ ] Coast: the `island.outline` Catmull-Rom curve; 12 m sand/rock stroke; 50 m shallows one value step lighter; four coasts with four characters (east cliffs, south beach, west plateau edge, north cliff drive).
- [ ] Offshore: the Lamp islet (`r` 40, `heightMax` 8, room for the 25 m lighthouse, jetty `structures.jetties.lamp`); the Needle's Eye as a natural arch with a real opening, thickness and underside (Ring Run gate 1); three Stacks with a gap wide enough for gate 2; the Wreck reef.
- [ ] Sea never visible through inland ground; terrain > 0 inside the outline except in named water bodies.

### Beds and structures (Track B)

- [ ] Every road (`roads.V01`, `VG`, `V02`, `VBS`, `spurs`) cut to `profiles.road` / `profiles.spur`: surface, shoulders, kerbs, 5 m clear; grades 4–6 % typical, every stretch above 8 % listed, nothing above 12 %; parapet + coping on every edge with a drop greater than body height; retaining walls (batter 1 : 6) on every cut.
- [ ] Every skate line (`skate.S1`–`S4`) cut to `profiles.skateMain` with each segment's `surface` and pace; banking ≤ 30°; 25 m run-out before every door and threshold; braking and reunion pockets to `profiles.skatePocket`; the Tideline park pad (`skate.park`).
- [ ] **The Wash bowl** at `skate.S2` segment 2: walls on both sides, a hip at the bend, centre `[465,700]`, in the dry `water.wash` bed.
- [ ] **The dam apron** (`structures.dam.apron`): the spillway apron as a half-pipe with a level line beside it; the S1 × walk lakerim row of `crossings`: board on the apron, walkers on the crest. The River Run portage steps beside the apron (`thresholds.damPortage`).
- [ ] **The Notch shelf**: S1's supported shelf under the High Span with its rail; river beside.
- [ ] **The High Span stack solved and reported** (`structures.highSpan`): river bed, the Reach walk at water level, the S1 shelf 12 m below the deck, Ring Run gate 3's aperture (`sky.gates` n 3: centre `h` 16, aperture 40 × 14 m, under the deck), the Green Road deck (`h_deck` 24; riverbed `h` 8, walk `h` 9, shelf `h` 12); each level with its own edge; supports visible from the walk.
- [ ] **The market stair** (`skate.S3` segment 2): three flights, 3 m wide, rise 0.17 m, riser faces, cheek walls, a rail per flight; its ramp twin ≤ 8 % (length ≥ drop ÷ 0.08), laid as the cobbled lane's switchback.
- [ ] Walks to `profiles.walk`, trails to `profiles.trail`, boardwalks to `profiles.boardwalk` on piles (the Reach boardwalk, Long Sands boardwalk).
- [ ] Every bridge (`highSpan`; `quayBridge` at `[1350,1345]` carrying V01 and S3's separated lane over the river mouth; `bightBridge` with its 230 m span, 8 m clear and S2's separated rail-side lane; `hollowBridge`, a covered footbridge on the garden walk and S4 over Orchard Brook, not on Green Road; the `inletFootbridge` and `reachFootbridge` on piles): deck ≥ 0.6 eu (walk decks ≥ 0.35 eu), bearings, piers or bents, footings, a visible underside, parapets or rails; a camera below each sees the underside.
- [ ] Both road tunnels (`prowTunnel` 90 m; `shoulderTunnel` 110 m at `[1445,480]` on Crown Road, which now starts at `[1500,340]`) and the Ore Line's own tunnel to its portal (`structures.southPortal`): portals, lining, ceiling, camera-compatible interior, road `clear_m` / rail `tunnel_clear_m`. The Dune Culvert (`structures.duneCulvert`): S4 under V01 with 3 m clear, a real dune tunnel with a ceiling.
- [ ] Stations and platforms as greybox solids on footings: gondola stations (`structures.gondolaStations`) and the three towers at `cable.G1.towers` (`[1450,958]`, `[1420,825]`, `[1390,693]`), heights solved so the cable clears terrain (the Shoulder band from `[1425,848]`) and every bed by `cable.G1.clear_eu` 8 and passes ≥ 12 m over `plot.terraces.*`; the zip's Prow tower (30 m, deck `h` 100, the same deck as the Prow glider launch) and its landing tower on the dune crest at `[1130,1440]` (deck `h` 12, 8 m above the Town Weave boardwalk that passes beneath it; a stair and a ramp down to the sand); Ore Line stations; the strip (`structures.strip`, 30 m wide) with hangar pad and windsock and balloon mooring footings; the floatplane dock; jetties and ferry piers (`water_routes.FERRY.piers`) on piles; the Landing quay (`structures.landingQuay`: S1's finish on the islet between the Reach's west channel and the river, reached over the Reach boardwalk on piles, with its 25 m run-out, kerb-separated from V01); the Apron Bridge (`structures.apronBridge` `[1158,949]`: S1 over the tailrace and the River Run); the town quay (`structures.townQuay` `[1420,1335]`→`[1497,1265]`, Lantern Row, pedestrian, 8 m inside the waterline) with the floatplane dock at `[1520,1275]`; the Sea Stair from the Sea Door pier up to the Prow walk; the Bight pier walk (`walks.bightPier`, with its plank footbridge over the Wash mouth) and the cove walk (`walks.coveWalk`) to the Scholars' cove pier.
- [ ] Cables: the zip (`cable.ZIP`, `sag_pct` 1) ≥ `minClearAboveRoof_eu` 12 eu above every roof (`hosts[*].roofH_eu` over `footprint_m`, `hostRule`), sag included, and ≥ 8 m above the gondola cable at their crossing `[1442,921]` (`crossings`: ZIP × G1, 10.7 m at 1 % sag); report the sagged profile of both cables in `evidence/cables.md`. A failure is a conflict for the design lead, not a reason to move either cable.
- [ ] Little Harbour's four tiers (upper street, square at `places.court.h`, storefront lane, quay) stepping down to the water; the square open to the north-west; nothing taller than 6 eu between its north-west edge and the dam line.

### Underground (Track B)

- [ ] The four doors (`underground.doors`): the Adit (timbered mouth greybox, `h` 40, feet and cart), the Throat (mouth `throat.mouth_m` 26 × 18 on the north face at `h` 110, a diving entry sloping 139 m at 30° down to the Deep; glider only), the Sea Door (sea cave at `h` 0 on the coast at `[1690,770]`, boat only, with its jetty `seaDoor.jetty` `[1705,775]` which is also the Ferry's pier; the Sea Stair climbs from it to the Prow walk; the Sea Passage leads to the Deep), the South Portal (`doors.southPortal` `[1345,680]`, `h` 110, feet and cart, 29 m from Crown Road's turning circle and linked to it by a path). The Dam Gallery (`underground.damGallery`) is a stair inside the dam's east abutment from the apron to the crest; it does not enter the Undercroft.
- [ ] The four rooms (`underground.rooms`: `lanternCave`, `deep`, `bellGallery`, `sealedDrift` = `plot.under.1`), all inside `underground.footprint`, as cave volumes with floors, walls and ceilings, clear heights within `profiles.cave.clear_m`.
- [ ] **The Ore Line tunnel** along `rail.ORE` to `profiles.rail` (gauge 0.9 m, tunnel clear 3.2 m), the drop at `rail.ORE.drop.at` with its `fall_m` 28 and its siding, the splash section through the Deep, and the climb out of the footprint by its own tunnel to the South Portal `[1345,680]`.
- [ ] **The Deep**: cavern lake at `water.deep.surface` 40 at `[1300,420]`, its jetty (`structures.jetties.deep`), the skylight shaft (`underground.rooms.deep.skylight`: 98 m, top `h` 138, opening on the north slope) admitting the sun (lit shaft reaches the water at noon; `STYLE §2.7`).
- [ ] **The Sea Passage** (`underground.doors.seaDoor.passage`, the line of `water_routes.DEEP_RUN`): the underground river leaving the Deep east to the Sea Door, a 504 m glow-worm-lit boat tunnel with a ceiling a canoe can pass; it falls by the Steps (three 12 m chutes in its first 120 m, ridden like a flume; `water_routes.DEEP_RUN.drop`), then runs level to the sea. The spring at `water.spring` `[1250,1180]` is a decorative spring at the Reach and is not connected to the Deep.
- [ ] No terrain hole except the named mouths and portals; rock over every passage ≥ 0.6 eu; every underground floor on a route at L* ≥ 14 at 02:00 (`STYLE §2.7`).

### Reserves (Track B)

- [ ] Eight pads (`reserves.terraces.plots`, `reserves.bightShore.plots`) at `size_m` 64 × 44, each at its own `rot_deg` (per plot; `reserves.rotRule`: the bearing of the 64 m axis, clockwise from east with y south), graded flat, 6 m clear on all sides, retaining walls, served per `reserves.*.served` (a lay-by each for Terraces plots 1–3 on the uphill (west) side of the Prow cliff drive and for plot 4 on its seaward side, D12 open; the gondola ≥ 12 m over every Terrace plot; Bight Shore via `VBS` and the jetty `structures.jetties.bightShore` `[735,955]`), plot spacing ≥ 56 m (`CONTRACT §5`), an apron facing the door-to-be, a greybox threshold marker, the reserved `placeId`.
- [ ] Two small reserves: the sealed drift beside the Lantern Cave; the hangar bay in the hangar pad.
- [ ] No pad, or its 6 m clear margin, inside `protected.green` (centre `[1040,1065]`, r 160 in the manifest; `CONTRACT §5`); no Sketchbook pose whose frame depends on a pad being empty.

### WorldDefinition, districts, sky, hosts, asset (Track C)

- [ ] `buildHorizonDefinition()` returns a complete `WorldDefinition` (`CONTRACT §4`) with `geographyRevision: 'horizon-geo-1'`; every id from `MANIFEST.json → names` or a stable pattern; `lanterns: []` (pass 4) and `lights` holding only the anchors pass 1 needs for night readability (door lamps as data, no cards).
- [ ] **The thirteen districts** of `MANIFEST.json → districts` as the streaming unit (`CONTRACT §4`): harbour, landing, reach, green, hollow, scholars, flats, bight, lakeside, notch, prow, crown, offshore; the Undercroft is the Crown's underground child district; the sky streams by the districts beneath it. Bounds proposed in `HANDOFF.md`.
- [ ] Seven hosts (`hosts`) as greybox volumes at `hosts[*].footprint_m` and `roofH_eu` on ground at `h` (`hostRule`: footprints scale, roof heights do not), each on an apron facing its `door`; the door anchor works: walking into it opens the host's existing tool route (`src/house/navigation.ts`); returning places the body on the apron facing out; the arrival camera frames the door, not the plot centre.
- [ ] The seven doors reachable on foot from the square without a stair edge (`CONTRACT §2.8`).
- [ ] Every threshold in `MANIFEST.json → thresholds` (v1.1 onwards carries the far ends: `gondolaTop`, `southPortal`, `zipLanding`, `lampGallery`, `deepJetty`, `seaDoorJetty`, `damPortage`, `bightShoreJetty`, `lampDock`, `landingQuay`) placed on a graded pad with a greybox marker and its mode pair; plus a pad, marker and kerb gap for every `threshold` row of `crossings` (among them S2's dismount `[660,1170]`, S2 × the Wash bed (closed for six hours after drizzle), S4 × VBS `[874,941]`, S4 × VG `[973,538]`, S4 × the studio spur, S4 × the garden walk on the Hollow Bridge, VG × the garden walk `[974,748]`, V01 × the Reach walk `[1367,1271]`, S3 × the town quay (`quayWest` `[1453,1277]`), S3 × V01 at the upper-street spur, V01 × the Bight pier walk `[407,894]`, S2 × the Bight pier walk `[509,896]`, V01 × the cove walk `[686,313]`, S1 × walk lakerim, S1 finish × V01). Any further one found is proposed with a camelCase id in `HANDOFF.md` for the design lead.
- [ ] **The crossing register**: every pairwise 2D intersection of bed, line and water centrelines is computed; each is either in `MANIFEST.json → crossings` or proposed as a new entry with `over` / `under` / `threshold` and its structure; each is built; `over`/`under` pairs are separated by at least the lower bed's clear height; `threshold` pairs have a marker, a kerb gap and a pad.
- [ ] `sky` envelope (`MANIFEST.json → sky`): ceiling 300 m; launches (`crown`, `prow`, `lampGallery`) as graded run-off edges; thermals, ridge, sink as data; landing fields (`green` at `[1040,1065]` r 60, `reachMeadow` `[1230,1190]` r 40, `sands`, the strip, water) open and clear of any structure; the twelve gates as volumes with measured apertures; the glide corridor from the Crown launch to the Lamp clear of terrain at `sky.glider` speed and sink with ≥ 10 eu margin.
- [ ] **The twelve Sketchbook poses** (`views`) authored as camera poses per `viewRule`: eye at `views[*].xy`, 1.6 eu above ground unless `eyeH` is given (J: 60), looking at `target`, horizontal `fov_deg` at 16:9, streaming radius `radius_eu`; each frames every subject in its `frames`; eye above ground; the horizon in frame; registered as `__harbour.shot('A')` … `shot('L')`.
- [ ] Terrain baked to `public/horizon/terrain/horizon-geo-1.bin` ≤ 2.5 MB (resolution reported), loaded async; nothing baked at module evaluation; the lite tier reads a lower LOD of the same asset.
- [ ] Fog, sky gradient and horizon cards per `STYLE §1.8` (Classic), full and lite.

### Lighting (all tracks)

- [ ] `solarPosition()` at 44° N from the device's time zone; `?sun=HH:MM` and `?date=YYYY-MM-DD` in dev builds only (`LIGHT §1`).
- [ ] Night readable (LIGHT §1): at 02:00 every door, threshold marker and edge lip is visible on a 390 px capture; minimum ambient set, a moon direction; nothing pitch dark.
- [ ] Sun-facing terrain: at solar noon a south-facing slope renders ≥ 8 L* above the north-facing slope of the same biome (`STYLE §1.2` rule 9); the Throat in shade at every sun-map time.

## Must not

Drawn from the Mountain v2 dissection (`NOT-THIS.md` has the full list):

- No cones, flat district discs, sine ripple or trenches as the terrain model.
- No ladder of near-straight traverses with hairpins; roads follow the land with grades inside `profiles.road`.
- No zero-thickness or FrontSide ribbon for any road, deck, walk, ramp or platform.
- No road edge with a drop above body height and no parapet.
- No destination off its bed; no plank aimed at a building centre; every door on an apron on a bed.
- No plot or reserve unserved or above 12 % grade to reach.
- No plank, shelf or line in the air without supports; no invisible rail; no cable bowing upward.
- No dam in a pit; no furniture or land bridge inside a basin.
- No river above its banks; no sea through inland ground; no summit sheared by an edge fade.
- No invisible wall: every edge is a visible lip, an unwalkable slope, or water.
- No finish line or run-out in the sea.
- No terrain bake at module evaluation; no synchronous district rebuild.
- No planting, props, dressing, text, labels or signs. No world-space text anywhere.
- No change to `src/core/`, `reading.ts`, `layout.ts`, `court/dressing.ts`, `place.ts`, the Desk.
- No real household data.

## Tests to add

| Test | Proves |
|---|---|
| `test/horizonLandforms.test.ts` | bands over ≥ 90 % of each polygon; asymmetry ≥ 25 %; summit at `crown.summit`; walkable limit enforced |
| `test/horizonWater.test.ts` | every water surface below its banks; monotonic descent; no sea sample inland; the Bight mouth width |
| `test/horizonBeds.test.ts` | widths to profile; grades ≤ 12 % (list > 8 %); kerbs; parapet on every drop > body height; skate banking ≤ 30°; run-outs |
| `test/horizonStructures.test.ts` | every structure has thickness ≥ `STYLE §1.6` minimums, a support within 15 eu of each deck end, a raycast-visible underside; tunnels have ceilings |
| `test/horizonCrossings.test.ts` | computed intersections ⊆ register; each resolution built; vertical separation ≥ lower clear height |
| `test/horizonThresholds.test.ts` | every threshold on a pad with a marker and mode pair; no bed passes a threshold without one |
| `test/horizonReserves.test.ts` | pad size, grade, clear margin, spacing ≥ 56 m, service, `placeId`; no pad or margin in `protected.green`; every pad on land |
| `test/horizonHostsDoors.test.ts` | seven doors reachable step-free from the square; door anchor in the apron; tool route opens; return faces out |
| `test/horizonUnderground.test.ts` | rooms and passages have floors and ceilings; no terrain hole except named mouths; rock cover ≥ 0.6 eu |
| `test/horizonJourneys.test.ts` | path-graph lengths × `scale.factor` ÷ `speeds_ms` reported against `journeys.targets_s` |
| `test/horizonStreaming.test.ts` | 13 districts (the Undercroft as the Crown's child); triangles ≤ 150 k / 60 k per district; residency ≤ 4 + sky ring / ≤ 3; ≤ 1 district built per frame |
| `test/horizonTerrainAsset.test.ts` | asset ≤ 2.5 MB; keyed by revision; no bake at import |
| `test/horizonSkyEnvelope.test.ts` | ceiling; gates' apertures clear; landing fields clear; glide corridor clear |
| `test/horizonViews.test.ts` | twelve poses; each subject projected inside the frame and unoccluded; eye above ground; horizon in frame |
| `test/horizonSavedPosition.test.ts` | `geo` mismatch → nearest path node |
| `test/horizonSolar.test.ts` | sunrise/sunset at 44° N within 2 min of reference on 21 Jun and 21 Dec; `?sun=` override |

Focused suites after each section: `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1`. Final SHA only: `tsc`, `pnpm build`, then `pnpm test -- --risk=high --focus=harbour --focus-reason="horizon p1: land, water, beds, structures, v3 definition"` within five minutes.

## Evidence required

| Evidence | Detail | File |
|---|---|---|
| **The twelve no-props renders** | each page `A`–`L` at `bestHour` and at `also`, full (1440 × 900) and lite (390 × 844), Classic, greybox: 48 images, each with a one-line verdict | `evidence/pages/<page>_<hh-mm>_classic_<full\|lite>.png`, `evidence/pages/VERDICTS.md` |
| **Slope map** | top-down, whole island: beds by grade class (≤ 6 %, ≤ 8 %, ≤ 12 %, > 12 %) and open ground walkable / non-walkable | `evidence/maps/slope.png` |
| **Sun map** | top-down lit / shaded faces and cast shadows at 09:00, 15:00, 19:00 on 21 June and 21 December (December 19:00 is after sunset: the map proves night) | `evidence/maps/sun_<date>_<hh-mm>.png` |
| **Journey timings** | each `journeys.targets_s` entry: path length (m and eu), assumed speed, time, target, pass/fail | `evidence/journeys.md` |
| **Crossing register** | every computed intersection: lines, point, resolution, structure, measured separation, built (y/n) | `evidence/crossings.md` |
| High Span stack | heights of river, walk, shelf, gate 3 aperture, deck | `evidence/highspan.md` |
| Probes | outputs of every test above as JSON | `evidence/probes/*.json` |
| Performance | per-district triangles and draw calls, first interactive, Walk↔Look frame log, asset size | `evidence/perf/*.json` |
| Walk | square → each of the seven doors on foot, step-free, timed | `evidence/rides/doors.md` |

## Gate

1. Claude reviews with `REVIEW-BRIEF.md`; Codex fixes every BLOCKER and MAJOR.
2. **Jonathan looks at the 48 renders, the slope map and the sun map before any line goes on the land.** He says go, or names what to re-cut.
3. Jonathan runs `TEST-PLAN.md` on his Mac and iPhone: the twelve shots, the walk to every door, one night capture.
4. Merge; `PIN-1` recorded with `horizon-geo-1`.

## Delivery

`~/Downloads/hearth-horizon-p1-land/`: `p1-land.bundle` (`PIN-0..codex/horizon-land`), `patches/`, `HANDOFF.md` (tracks, conflicts, proposed thresholds, proposed crossings, the district partition, the terrain resolution, the walkable limit), `FINISH-PROMPT.md`, `TEST-PLAN.md`, `evidence/`. Codex pushes `codex/horizon-land` as a draft PR; it merges only after the gate.

## Reconciled to MANIFEST v1.1 (reviewer)

- Track A: `?date=` added beside `?sun=` (LIGHT v1.1 gives pass 1 both overrides and `solar.ts`).
- Track B underground scope: the Dam Gallery no longer enters the Undercroft; the Sea Passage (to the Sea Door) replaces "the Deep Run's underground river to the spring"; the Ore Line's own tunnel to the South Portal and the skylight shaft added.
- Bight mouth: 260 m replaced by `bightBridge.span_m` 230.
- Dam apron: the stale `[1200,905]` point replaced by the register row; the dam portage threshold named.
- High Span stack: gate 3 aperture centre `h` 30 → 16 (40 × 14 m), with deck/bed/walk/shelf heights from `structures.highSpan`.
- Bridges: Quay Bridge position and deck, S2's lane on the Bight Bridge, the Hollow Bridge as a covered footbridge (not on Green Road), the two footbridges added. Tunnels: the Ore Line "twin bore" replaced by its own tunnel to the South Portal; the Dune Culvert added.
- Landing quay (S1 finish) and town quay added; zip roof clearance and zip-over-gondola separation added as a Must produce with a report.
- Underground doors: Dam Gallery replaced by the South Portal; the Throat as a diving entry; the Sea Door as boat-only with the Sea Passage. The Deep's surface 30 → 40; skylight shaft cited.
- Reserves: Bight Shore jetty `[760,963]` → `[735,955]`; Terraces lay-bys on the uphill side; spacing ≥ 56 m; protected radius cited from the manifest (r 160).
- Districts: twelve (pass-1 proposal) → the manifest's thirteen; streaming test count updated.
- Thresholds: the far ends the v1.0 brief asked pass 1 to propose are now in the manifest; the pads implied by the register's `threshold` rows listed instead.

### v1.2 deltas (reviewer, MANIFEST v1.2)

- Landform bands now follow v1.2's `landformRule` (cutInto, 60 m blends, beds override bands within width + 15 m); the old citation of `STYLE §1.4.1` rule 11 (a planting blend) removed.
- River mouth to `[1364,1390]`; the Cup's outflow is scenery.
- Shoulder Tunnel `[1445,480]`; Crown Road starts `[1500,340]`.
- Gondola towers, `clear_eu` 8 and ≥ 12 m over the Terraces; zip Prow tower (deck h 100, shared with the glider launch) and landing tower `[1130,1440]` (deck h 12 over S3); zip clearance in eu with `sag_pct` 1 and host `roofH_eu`; ZIP × G1 at `[1442,921]`.
- S1 finish on the Reach islet; Apron Bridge; town quay and floatplane dock re-laid; Sea Stair; `walks.bightPier` and `walks.coveWalk`.
- Throat 139 m at 30°; Sea Door `[1690,770]`, jetty/pier `[1705,775]`; South Portal `[1345,680]`; skylight 98 m, top h 138; Sea Passage 504 m with the Steps.
- Reserves: per-plot `rot_deg` and `rotRule`; Terraces plot 4 seaward (D12); protected centre `[1040,1065]`.
- Hosts sized by `footprint_m` / `roofH_eu`; v1.2 threshold rows from `crossings` listed; landing fields `green` (moved) and `reachMeadow`; poses per `viewRule` (target, fov, radius, eyeH).


## Added for SCALES.md (the Journey scale)
- **The Year Walk is a bed.** Cut `MANIFEST.json → journey.yearWalk` to the `walk` profile, reusing existing walks and trails where they coincide; author the link segments; register any new crossing.
- **Twelve station pads** (`journey.stations`, pad 36 × 14 m each, level, facing the sun per LIGHT): graded now, empty. Two rows of ten bed positions per pad are marked in the WorldDefinition; no bed exists until the overlay derives it.
- **The homestead pads** in Little Harbour's slope (`journey.homestead`): the yard behind Our home, the lane to the quay, the household's footbridge site over the town channel (a real footbridge with an underside; its planks are the overlay's business), the kitchen garden's bed, the pavilion's pad, the workbench's pad; the Kitty plaza beside the bank.
- **Two LODs baked** from the same heightfield: the world's and the Journey's L0/L1 (decimation 8, coast ≤ 400 vertices), both keyed by `GEOGRAPHY_REVISION`; L0/L1 within the budgets in CONTRACT §6.
- **Evidence:** a render of the island at L0 beside page E (the Crown, noon); they must read as the same place with the buildings hidden.
- **Day-stones**: the Year Walk's bed is cut wide enough for the stone module (`journey.stretch`) with a verge each side for markers; stretch lengths are the Walk's authored link lengths, so the land pass records each stretch's length and the stone spacing that fits 28–31 stones (stones may be denser on short stretches; the Walk may add a switchback where a stretch is too short).
