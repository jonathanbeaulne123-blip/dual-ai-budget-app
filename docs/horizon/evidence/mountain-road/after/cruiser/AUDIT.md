# Horizon road audit — after

Driver's-eye audit of the committed bake with the real cruiser sim (`stepCruiser`, CRUISER.dt = 1/120 s). Read-only: nothing under `src/` or `public/` was changed.

- Command: `node scripts/horizon/road-audit.mjs --mountain-chain --out docs/horizon/evidence/mountain-road/after/cruiser --title after` (from the repo root)
- Checkout: `750150f887f96ba1fa991056f23fe3f66345a769`; world `public/horizon/world/horizon-geo-1.json.gz` sha256 `1656541de1339ec5…`, terrain sha256 `908a33ea9a001144…` (horizon-geo-1)
- Wall-clock: **22.8 s** on 8 CPUs (v24.21.0); generated 2026-09-30T13:27:20.568Z
- Roads: mountain-chain

**Scope:** drive enabled; static sweep enabled. The mountain chain shares its source with the bake and varies width at each station. Endpoint completion after restarts is not uninterrupted acceptance.

## Method

- **World**: `parseHorizonDefinition(horizon-geo-1.json.gz)` + `decodeTerrainAsset(bin,'full')` + `createHorizonGeography(field,{...collision, solids, diagnostics})` + `addDynamic(createMountainV2Region(...).provider)` — the loader of `test/horizonRideSituations.test.ts`.
- **Drive**: pure pursuit (lookahead 6–8 m) on the lane line; target speed = min(16, √(4/κ)) braked back at 5 m/s²; throttle/coast/brake only through `stepCruiser` inputs; no snapping. Passes: forward and reverse, centreline and keep-right +2 m (5 m-wide spurs: centreline only). V01 is driven round the whole loop (+10 m). A stall longer than 2 s, or leaving the corridor (> half-width + shoulder + 5 m, or 4 m below the bed), is logged and the drive restarts 6–8 m further on (listed per pass).
- **Static** (every 2 m station, no driving): *lateral scan* both sides in 0.25 m steps from the centreline at the deck height — `geography.contact` (r 0.2) at the rider's body band, surface continuity (±0.5 m), water, > 40°, or no ground; a transverse crack between segment prisms (deck continues 0.15 m either side along the road, or within 0.6 m further out) is stepped over, not an edge → usable width, drop depth beyond the first edge. *Missing guard* = a drop > 1.25 m that starts within the bed edge + 1.5 m with no rail/wall stopping the scan first (drops further out are listed as MINOR `verge-drop`). *Unguarded step* = 0.5–1.25 m drop at the edge. *Buried* = visible terrain above the deck at five points across the carriageway (skipped under a roof whose underside is below that terrain). *Floating edge* = deck-edge bottom (deck − 0.6 m) more than 0.3 m above the terrain 0.3 m outside the edge with no wall/rail/support solid below it (not on structures). *Headroom* = every downward-facing static face whose plan falls inside the carriageway box of that station with its underside 0.1–5 m above the deck (this road's own parapet coping excluded), plus the dynamic (Mountain v2) ceiling. *Native owned guards* remain physical width limits and controller contacts; only duplicate scenery/obstruction labels are omitted when source endpoints, station, level and edge placement agree. Intrusions and adjacent road levels retain their findings. *Kerbs* = own kerb solid at ±half-width. *Scenery* = non-walkable static solids not belonging to the road, and v2 dynamic solids except verified same-station, same-level native edge guards, within the carriageway + 1 m, 0.3–4.5 m above the deck.
- **Lips** (every 0.1 m along five lines at 0, ±0.375, ±0.75 × half-width, interpolated so a line never cuts a corner): step in the physical surface with the local grade removed, > 0.08 m. A run of steps that returns to its starting height within 0.6 m is one *crack* (gap) or *ridge* — the 1.12 m wheelbase bridges a crack ≤ 0.3 m wide, so such a crack is MAJOR only when deeper than groundSnap (a foot, a board wheel or the rider's centre can fall in), else MINOR. *Junctions*: every threshold crossing of a road — the other route's bed ±20 m (to the road edge + 6 m) and the road ±15 m on three lines. *Pads*: every non-threshold pad within reach of a road — three lines from the road into 4 m inside the pad. *Transitions*: ±15 m on five lines at every structure-bed end within 12 m of a road. *v2 planting*: `mountainPlanting('full')` trees and shrubs kept where the region draws them, against every road (trunk inside the carriageway, within 1 m of it, or crown below 2.8 m over it).
- **Cross-reference**: every static finding lists the driving events (type:pass) within ±6 m of it, so "a lip exists" and "the cruiser felt it" stay separate facts.
- **Sampling**: nothing was sub-sampled beyond the steps above; the whole run took 22.8 s.
- **Severity**: BLOCKER = stops or launches the cruiser (stall, airborne > 0.1 s, lip up > 0.48 m or down > 0.55 m that is not a narrow crack, hole), buries it (terrain > 0.48 m over the deck), or headroom < 1.55 m. MAJOR = lip > 0.15 m, crack deeper than 0.55 m, missing guard over a > 1.25 m drop, usable width < 7 m (8 m roads) / < width − 0.5 m (5 m spurs), grade > 12 % per 10 m, contact while inside the carriageway, obstruction inside the carriageway at body height, buried 0.15–0.48 m, floating edge > 1 m, headroom < 5 m, v2 tree trunk in the carriageway, the Bight Bridge frame mismatch when V01's edge leaves the deck. MINOR otherwise.

## Totals

| Road | Length m | BLOCKER | MAJOR | MINOR | Drives (dir/lane: distance, restarts) | Kerb cover L/R |
|---|---:|---:|---:|---:|---|---|
| mountain-chain | 1288.2 | 4 | 141 | 60 | fwd/centre: 1287 m, 0r; fwd/right+2: 1287 m, 1r; rev/centre: 1287 m, 1r; rev/right+2: 1287 m, 2r | 0% / 0% |
| **all** | | **4** | **141** | **60** | | |

Issue counts are after merging the same driving event (same type and solid within 6 m) across passes and merging static stations into runs.

## Top issues (BLOCKER, then MAJOR; main roads first)

| # | Sev | Road | Station m | At [x, y, z] | Type | Cause | Seen by drives |
|---:|---|---|---|---|---|---|---|
| 1 | BLOCKER | mountain-chain | 585.5 | [1352.8, 73.2, 656.9] | pad-lip | pad station.jan (station, top 73.2 vs road bed 74.29): 1 lips between the road and 4 m inside the pad; worst 7.4 m out from the road centre: step up 0.75 m terrain → station.jan.slab@crown | — |
| 2 | BLOCKER | mountain-chain | 483.5 | [1375.7, 64.1, 688.1] | stall | stalled against terrain (terrain/sim) | rev/right+2 |
| 3 | BLOCKER | mountain-chain | 540.5 | [1329.6, 69.6, 670.7] | stall | stalled against terrain (terrain/sim) | fwd/right+2 |
| 4 | BLOCKER | mountain-chain | 1215 | [1392.3, 151.5, 479.8] | stall | stalled against terrain (terrain/sim) | rev/centre, rev/right+2 |
| 5 | MAJOR | mountain-chain | 350–398 | [1280.9, 56.6, 703.6] | grade | 48 m over 8 % (max 15.3 % per 10 m) — over the 12 % profile maximum | drive-lip:fwd/right+2, surface-mismatch:fwd/right+2, drive-lip:rev/right+2 |
| 6 | MAJOR | mountain-chain | 1016–1282 | [1354.5, 128.8, 552.3] | grade | 266 m over 8 % (max 15.1 % per 10 m) — over the 12 % profile maximum | drive-lip:fwd/centre, drive-lip:fwd/right+2, contact:fwd/right+2, drive-lip:rev/centre, stall:rev/centre, drive-lip:rev/right+2, stall:rev/right+2 |
| 7 | MAJOR | mountain-chain | 470–750 | [1357.1, 90.2, 605.1] | grade | 280 m over 8 % (max 14.1 % per 10 m) — over the 12 % profile maximum | drive-lip:fwd/centre, drive-lip:fwd/right+2, stall:fwd/right+2, drive-lip:rev/centre, drive-lip:rev/right+2, stall:rev/right+2 |
| 8 | MAJOR | mountain-chain | 776–974 | [1246.1, 118.2, 527] | grade | 198 m over 8 % (max 14 % per 10 m) — over the 12 % profile maximum | — |
| 9 | MAJOR | mountain-chain | 412 | [1318.6, 61.1, 687.3] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:61:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 10 | MAJOR | mountain-chain | 414 | [1320.5, 61.2, 687.9] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:61:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 11 | MAJOR | mountain-chain | 418 | [1324.2, 61.3, 689.3] | scenery | mountainV2/dynamic mountainV2:path:stair:station-steps inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 12 | MAJOR | mountain-chain | 426 | [1331.6, 61.5, 692.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 13 | MAJOR | mountain-chain | 428 | [1333.4, 61.5, 693.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 14 | MAJOR | mountain-chain | 430 | [1335.2, 61.6, 694.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 15 | MAJOR | mountain-chain | 432 | [1336.9, 61.6, 695.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 16 | MAJOR | mountain-chain | 434 | [1338.6, 61.6, 696.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:8 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 17 | MAJOR | mountain-chain | 542–544 | [1327.4, 69.8, 669.5] | scenery | mountainV2/dynamic mountainV2:orchard-lane inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | drive-lip:fwd/centre, stall:fwd/right+2, drive-lip:rev/centre, drive-lip:rev/right+2 |
| 18 | MAJOR | mountain-chain | 706 | [1357.1, 90.2, 605.1] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 19 | MAJOR | mountain-chain | 708 | [1355.2, 90.5, 604.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 20 | MAJOR | mountain-chain | 710 | [1353.4, 90.8, 603.7] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 21 | MAJOR | mountain-chain | 736 | [1339, 94.2, 584.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:383:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 22 | MAJOR | mountain-chain | 738 | [1338.1, 94.4, 582.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:383:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 23 | MAJOR | mountain-chain | 968 | [1277.6, 122.5, 539.3] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 24 | MAJOR | mountain-chain | 970 | [1279.4, 122.7, 540.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 25 | MAJOR | mountain-chain | 972 | [1281.2, 122.8, 541.1] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 26 | MAJOR | mountain-chain | 974 | [1283, 123, 541.9] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 27 | MAJOR | mountain-chain | 976 | [1284.8, 123.1, 542.8] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:8 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 28 | MAJOR | mountain-chain | 984 | [1292, 123.5, 546.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 29 | MAJOR | mountain-chain | 986 | [1293.8, 123.6, 547.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 30 | MAJOR | mountain-chain | 988 | [1295.6, 123.7, 548] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 31 | MAJOR | mountain-chain | 990 | [1297.5, 123.8, 548.8] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 32 | MAJOR | mountain-chain | 992 | [1299.4, 123.9, 549.5] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:8 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 33 | MAJOR | mountain-chain | 994 | [1301.2, 123.9, 550.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:10 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 34 | MAJOR | mountain-chain | 996 | [1303.1, 124, 550.8] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:12 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 35 | MAJOR | mountain-chain | 998 | [1305.1, 124.1, 551.3] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:14 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 36 | MAJOR | mountain-chain | 1000 | [1307, 124.2, 551.7] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:16 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 37 | MAJOR | mountain-chain | 1002 | [1309, 124.2, 552.1] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:18 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 38 | MAJOR | mountain-chain | 1004 | [1311, 124.3, 552.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:20 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 39 | MAJOR | mountain-chain | 1006 | [1312.9, 124.4, 552.7] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:22 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 40 | MAJOR | mountain-chain | 1008 | [1314.9, 124.5, 552.9] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:24 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 41 | MAJOR | mountain-chain | 1010 | [1316.9, 124.6, 553.1] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:26 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 42 | MAJOR | mountain-chain | 1012 | [1318.9, 124.7, 553.3] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:28 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 43 | MAJOR | mountain-chain | 1014 | [1320.9, 124.8, 553.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:30 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 44 | MAJOR | mountain-chain | 1016 | [1322.9, 125, 553.5] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:32 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 45 | MAJOR | mountain-chain | 1018 | [1324.9, 125.1, 553.5] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:34 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 46 | MAJOR | mountain-chain | 1020 | [1326.9, 125.3, 553.5] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:36 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 47 | MAJOR | mountain-chain | 1022 | [1328.9, 125.4, 553.5] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:38 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 48 | MAJOR | mountain-chain | 1024 | [1330.9, 125.6, 553.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:40 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 49 | MAJOR | mountain-chain | 1026 | [1332.9, 125.8, 553.3] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:42 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 50 | MAJOR | mountain-chain | 1028 | [1334.9, 126, 553] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:44 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 51 | MAJOR | mountain-chain | 1030 | [1336.8, 126.3, 552.6] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:46 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 52 | MAJOR | mountain-chain | 1032 | [1338.8, 126.5, 552.2] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:48 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 53 | MAJOR | mountain-chain | 1034 | [1340.8, 126.8, 551.8] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:50 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 54 | MAJOR | mountain-chain | 1036 | [1342.7, 127, 551.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:52 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 55 | MAJOR | mountain-chain | 1038 | [1344.7, 127.3, 551.1] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:54 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 56 | MAJOR | mountain-chain | 1040 | [1346.7, 127.6, 551] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:56 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 57 | MAJOR | mountain-chain | 1166 | [1352.9, 145.8, 501.1] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:parapet:821:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 58 | MAJOR | mountain-chain | 1174 | [1358, 146.8, 495.3] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 59 | MAJOR | mountain-chain | 1176 | [1359.8, 147, 494.4] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 60 | MAJOR | mountain-chain | 1178 | [1361.6, 147.3, 493.6] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |

## mountain-chain — 9.6 m bed, 1288.2 m

Drives: **fwd/centre** 1287 m in 114.5 s sim (mean 11.21 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 1287 m in 115.7 s sim (mean 11.04 m/s, max 16), 251 contact steps, 0 airborne steps, restarts: stall terrain @540.5 · **rev/centre** 1287 m in 115.8 s sim (mean 11.02 m/s, max 16), 236 contact steps, 0 airborne steps, restarts: stall terrain @1215 · **rev/right+2** 1287 m in 117.8 s sim (mean 10.8 m/s, max 16), 470 contact steps, 0 airborne steps, restarts: stall terrain @1215; stall terrain @483.5

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 483.5 | [1375.7, 64.1, 688.1] | —  | rev/right+2 | stalled against terrain (terrain/sim) |
| BLOCKER | stall | 540.5 | [1329.6, 69.6, 670.7] | —  | fwd/right+2 | stalled against terrain (terrain/sim) |
| BLOCKER | pad-lip | 585.5 | [1352.8, 73.2, 656.9] | 0.753 m step | static | pad station.jan (station, top 73.2 vs road bed 74.29): 1 lips between the road and 4 m inside the pad; worst 7.4 m out from the road centre: step up 0.75 m terrain → station.jan.slab@crown |
| BLOCKER | stall | 1215 | [1392.3, 151.5, 479.8] | —  | rev/centre, rev/right+2 (2×) | stalled against terrain (terrain/sim) |
| MAJOR | lip | 338.8 | [1278.9, 55.2, 730.5] | 0.173 m step | static | step up 0.17 m yearWalk.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside on lines -2.62 m |
| MAJOR | lip | 343.4–343.9 | [1279, 55, 725.9] | 0.249 m step | static | step up 0.25 m yearWalk.bed.lakeside@lakeside → S1.batter@lakeside on lines -2.62, 1.31 m |
| MAJOR | drive-lip | 343.5 | [1283, 55.2, 725.9] | 0.158 m | fwd/right+2 | step up 0.16 m between yearWalk.shoulders.lakeside@lakeside and yearWalk.batter@lakeside |
| MAJOR | drive-lip | 344.5 | [1279.7, 54.8, 724.7] | -0.22 m | rev/right+2 | step down 0.22 m between S1.batter@lakeside and yearWalk.bed.lakeside@lakeside |
| MAJOR | drive-lip | 345 | [1279.7, 55, 724.5] | 0.195 m | rev/right+2 | step up 0.20 m between yearWalk.bed.lakeside@lakeside and S1.batter@lakeside |
| MAJOR | lip | 346.3–346.5 | [1283.1, 54.6, 723.2] | -0.483 m step | static | step down 0.48 m yearWalk.batter@lakeside → spur stillwater.corridor.deck.1.lakeside@lakeside on lines 1.31, 2.63 m |
| MAJOR | drive-lip | 346.5–351 | [1283.4, 54.6, 723.1] | -0.433 m | fwd/right+2 (2×) | step down 0.43 m between yearWalk.batter@lakeside and S1.surface.7.lakeside@lakeside |
| MAJOR | drive-lip | 348.5 | [1283.5, 55, 720.7] | 0.337 m | fwd/right+2 | step up 0.34 m between S1.surface.7.lakeside@lakeside and yearWalk.batter@lakeside |
| MAJOR | lip | 348.7 | [1283.3, 55.1, 720.7] | 0.39 m step | static | step up 0.39 m S1.surface.7.lakeside@lakeside → yearWalk.batter@lakeside on lines 1.31, 2.63 m |
| MAJOR | grade | 350–398 | [1280.9, 56.6, 703.6] | 15.27 % max | static | 48 m over 8 % (max 15.3 % per 10 m) — over the 12 % profile maximum |
| MAJOR | lip | 350.9–351.1 | [1283.1, 54.8, 718.1] | -0.313 m step | static | step down 0.31 m yearWalk.batter@lakeside → S1.surface.7.lakeside@lakeside on lines 2.71, 1.36 m |
| MAJOR | obstruction | 378 | [1286.8, 58.4, 693.3] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:30:0 inside the carriageway at 4.75 m from centre |
| MAJOR | scenery | 378 | [1286.8, 58.4, 693.3] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:30:0 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 412 | [1318.6, 61.1, 687.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:61:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 414 | [1320.5, 61.2, 687.9] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:61:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 418 | [1324.2, 61.3, 689.3] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:path:stair:station-steps inside the carriageway at 4.75 m from centre |
| MAJOR | scenery | 418 | [1324.2, 61.3, 689.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:path:stair:station-steps inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 426 | [1331.6, 61.5, 692.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 428 | [1333.4, 61.5, 693.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 430 | [1335.2, 61.6, 694.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 432 | [1336.9, 61.6, 695.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 434 | [1338.6, 61.6, 696.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:74:8 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | grade | 470–750 | [1357.1, 90.2, 605.1] | 14.07 % max | static | 280 m over 8 % (max 14.1 % per 10 m) — over the 12 % profile maximum |
| MAJOR | missing-guard | 510 | [1352.9, 66.7, 682] | 1.61 m drop | static | left edge: 1.61 m drop at 5 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | floating-edge | 510–514 | [1348.9, 67.1, 682] | 1.35 m gap | static | left deck edge hangs 1.35 m over the terrain with no retaining wall or parapet, over 6 m |
| MAJOR | buried | 510–516 | [1352.9, 67, 677.7] | 0.308 m terrain above deck | static | visible terrain 0.308 m above the deck inside the carriageway over 8 m |
| MAJOR | lip | 510 | [1352.9, 66.9, 678.4] | 0.187 m step | static | step up 0.19 m mountainV2:mountain-road → terrain on lines 3.6 m |
| MAJOR | obstruction | 512 | [1350.9, 66.9, 682] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:164:0 inside the carriageway at 4.5 m from centre |
| MAJOR | headroom | 512–520 | [1344.9, 67.5, 681.9] | 2.82 m clear | static | 2.82 m headroom under oreTunnel.roof@undercroft at 4.79 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| MAJOR | drive-lip | 516 | [1347.1, 67.4, 679.9] | 0.161 m | fwd/right+2 | step up 0.16 m between oreStation.southPortal.slab@crown and oreTunnel.floor@undercroft |
| MAJOR | lip | 516.1 | [1346.9, 67.4, 680.2] | 0.172 m step | static | step up 0.17 m oreStation.southPortal.slab@crown → oreTunnel.floor@undercroft on lines 1.8, 3.6 m |
| MAJOR | lip | 539.9–541.1 | [1323.5, 70.1, 669.9] | 0.367 m step | static | step up 0.37 m mountainV2:mountain-road → mountainV2:orchard-lane on lines -1.8, 3.6, -3.6 m |
| MAJOR | drive-lip | 540–544 | [1325.6, 69.6, 671.6] | -0.204 m | fwd/centre, rev/right+2 (2×) | step down 0.20 m between mountainV2:orchard-lane and mountainV2:mountain-road |
| MAJOR | scenery | 542–544 | [1327.4, 69.8, 669.5] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:orchard-lane inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | lip | 559.2–560.5 | [1341.7, 71.7, 666.6] | 0.247 m step | static | step up 0.25 m mountainV2:mountain-road → mountainV2:hearth-awning on lines 3.6, 1.8, 0 m |
| MAJOR | drive-lip | 560–563 | [1342.6, 71.8, 664.4] | 0.246 m | fwd/right+2, rev/centre (2×) | step up 0.25 m between mountainV2:mountain-road and mountainV2:hearth-awning |
| MAJOR | drive-lip | 560.5 | [1343, 71.6, 663.1] | -0.202 m | rev/centre | step down 0.20 m between mountainV2:hearth-awning and mountainV2:mountain-road |
| MAJOR | floating-edge | 570–572 | [1354.5, 72.8, 663.9] | 1.84 m gap | static | right deck edge hangs 1.84 m over the terrain with no retaining wall or parapet, over 4 m |
| MAJOR | obstruction | 572 | [1354.5, 72.8, 663.9] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:0 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 572 | [1354.5, 72.8, 663.9] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:0 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 592–606 | [1373.9, 75.1, 660] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:18 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 592 | [1373.9, 75.1, 660] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:18 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 594 | [1375.8, 75.4, 659.3] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:20 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 596 | [1377.6, 75.6, 658.5] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:22 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 598 | [1379.5, 75.9, 657.7] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:24 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 600 | [1381.3, 76.1, 656.8] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:26 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 602 | [1383, 76.4, 655.9] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:28 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 604 | [1384.8, 76.6, 655] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:30 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 606 | [1386.5, 76.9, 653.9] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:32 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 706 | [1357.1, 90.2, 605.1] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:0 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 706 | [1357.1, 90.2, 605.1] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 708 | [1355.2, 90.5, 604.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 710 | [1353.4, 90.8, 603.7] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:4 inside the carriageway at 4.75 m from centre |
| MAJOR | scenery | 710 | [1353.4, 90.8, 603.7] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | missing-guard | 712–714 | [1349.8, 91.3, 601.8] | 1.68 m drop | static | left edge: 1.68 m drop at 5 m from centre with no guard (onto mountainV2:path:stair:woods-steps-2) over 4 m |
| MAJOR | floating-edge | 712–716 | [1349.8, 91.3, 601.8] | 1.22 m gap | static | left deck edge hangs 1.22 m over the terrain with no retaining wall or parapet, over 6 m |
| MAJOR | scenery | 736 | [1339, 94.2, 584.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:383:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 738 | [1338.1, 94.4, 582.4] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:383:6 inside the carriageway at 4.5 m from centre |
| MAJOR | obstruction | 738–740 | [1338.1, 94.4, 582.4] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:391:0 inside the carriageway at 4.75 m from centre |
| MAJOR | scenery | 738 | [1338.1, 94.4, 582.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:383:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 754 | [1324.2, 95.7, 575] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:4 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 758 | [1320.3, 95.9, 573.9] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:8 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 760 | [1318.4, 96, 573.4] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:10 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 772 | [1306.6, 96.8, 571.3] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:22 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 776 | [1302.6, 97.1, 571.1] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:26 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | grade | 776–974 | [1246.1, 118.2, 527] | 14.04 % max | static | 198 m over 8 % (max 14 % per 10 m) — over the 12 % profile maximum |
| MAJOR | scenery | 778 | [1300.6, 97.2, 571] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:28 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 780 | [1298.6, 97.4, 570.9] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:30 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 782 | [1296.6, 97.5, 570.7] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:32 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 784 | [1294.6, 97.7, 570.5] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:34 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 786 | [1292.7, 97.9, 570.1] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:36 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 786 | [1292.7, 97.9, 570.1] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:36 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 788 | [1290.7, 98.1, 569.6] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:38 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 790 | [1288.8, 98.3, 569.1] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:40 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 792 | [1286.9, 98.5, 568.4] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:42 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 802 | [1277.6, 99.8, 564.7] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:454:0 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 804–808 | [1275.7, 100.1, 564.3] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:454:2 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 804 | [1275.7, 100.1, 564.3] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:454:2 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 806 | [1273.7, 100.3, 564] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:454:4 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 808 | [1271.7, 100.6, 563.9] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:454:6 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 812 | [1267.7, 101.2, 564.3] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:464:0 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 812 | [1267.7, 101.2, 564.3] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:464:0 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | lip | 812.5–813.3 | [1266.7, 101.6, 560.8] | 0.341 m step | static | step up 0.34 m mountainV2:mountain-road → mountainV2:path:stair:meadow-steps-1 on lines 3.6 m |
| MAJOR | scenery | 968 | [1277.6, 122.5, 539.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 970 | [1279.4, 122.7, 540.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 972 | [1281.2, 122.8, 541.1] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 974 | [1283, 123, 541.9] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 976 | [1284.8, 123.1, 542.8] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:8 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 984 | [1292, 123.5, 546.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 986 | [1293.8, 123.6, 547.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 988 | [1295.6, 123.7, 548] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 990 | [1297.5, 123.8, 548.8] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:6 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 992 | [1299.4, 123.9, 549.5] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:8 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 994 | [1301.2, 123.9, 550.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:10 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 996 | [1303.1, 124, 550.8] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:12 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 998 | [1305.1, 124.1, 551.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:14 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1000 | [1307, 124.2, 551.7] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:16 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1002 | [1309, 124.2, 552.1] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:18 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1004 | [1311, 124.3, 552.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:20 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1006 | [1312.9, 124.4, 552.7] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:22 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1008 | [1314.9, 124.5, 552.9] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:24 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1010 | [1316.9, 124.6, 553.1] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:26 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1012 | [1318.9, 124.7, 553.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:28 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1014 | [1320.9, 124.8, 553.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:30 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1016 | [1322.9, 125, 553.5] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:32 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | grade | 1016–1282 | [1354.5, 128.8, 552.3] | 15.11 % max | static | 266 m over 8 % (max 15.1 % per 10 m) — over the 12 % profile maximum |
| MAJOR | scenery | 1018 | [1324.9, 125.1, 553.5] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:34 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1020 | [1326.9, 125.3, 553.5] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:36 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1022 | [1328.9, 125.4, 553.5] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:38 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1024 | [1330.9, 125.6, 553.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:40 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1026 | [1332.9, 125.8, 553.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:42 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1028 | [1334.9, 126, 553] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:44 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1030 | [1336.8, 126.3, 552.6] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:46 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1032 | [1338.8, 126.5, 552.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:48 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1034 | [1340.8, 126.8, 551.8] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:50 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1036 | [1342.7, 127, 551.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:52 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 1038 | [1344.7, 127.3, 551.1] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:619:74 inside the carriageway at 4.75 m from centre |
| MAJOR | scenery | 1038 | [1344.7, 127.3, 551.1] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:54 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1038 | [1344.7, 127.3, 551.1] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:619:74 inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1040 | [1346.7, 127.6, 551] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:56 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | missing-guard | 1044 | [1350.7, 128.2, 551.4] | 1.29 m drop | static | right edge: 1.29 m drop at 6 m from centre with no guard (onto mountainV2:path:stair:rim-steps) over 2 m |
| MAJOR | drive-lip | 1154 | [1356.7, 144.3, 513] | -0.267 m | rev/centre, rev/right+2 (2×) | step down 0.27 m between mountainV2:dam-promenade and mountainV2:mountain-road |
| MAJOR | lip | 1154.1–1154.4 | [1355.8, 144.7, 513.9] | 0.295 m step | static | step up 0.29 m mountainV2:mountain-road → mountainV2:dam-promenade on lines -1.8, -3.6 m |
| MAJOR | obstruction | 1166 | [1352.9, 145.8, 501.1] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:821:2 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 1166 | [1352.9, 145.8, 501.1] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:821:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1174 | [1358, 146.8, 495.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1176 | [1359.8, 147, 494.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:2 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1178 | [1361.6, 147.3, 493.6] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:4 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1182 | [1365.4, 147.7, 492.4] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:8 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1184 | [1367.4, 148, 492.2] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:10 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 1212–1218 | [1392.3, 151.2, 482.9] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:873:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 1216 | [1392.6, 151.5, 479] | 4.25 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:873:0 inside the carriageway at 4.25 m from centre |
| MAJOR | obstruction | 1240 | [1371.4, 153.9, 472.3] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:899:0 inside the carriageway at 4.5 m from centre |
| MAJOR | scenery | 1240 | [1371.4, 153.9, 472.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:899:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 1284 | [1328.9, 158, 472] | 3 m from centre | static | tower/support crownLaunch.columns@crown inside the carriageway at 3 m from centre |
| MAJOR | scenery | 1284–1286 | [1327, 158.1, 471.3] | 2.2 m from centre | static | tower/support crownLaunch.columns@crown inside the carriageway (2.2 m from centre, lowest face 0.3 m above the deck) |
| MAJOR | lip | 1285–1286 | [1328, 158.2, 471.7] | 0.166 m step | static | step up 0.17 m mountainV2:mountain-road → threshold.skateLineStarts.1.slab@crown on lines 0, 1.8, -1.8 m |
| MAJOR | drive-lip | 1285–1285.5 | [1328, 158.2, 471.8] | 0.169 m | fwd/centre, fwd/right+2 (2×) | step up 0.17 m between mountainV2:mountain-road and threshold.skateLineStarts.1.slab@crown |
| MAJOR | drive-lip | 1285–1286.5 | [1328, 158, 471.7] | -0.167 m | rev/centre, rev/right+2 (2×) | step down 0.17 m between threshold.skateLineStarts.1.slab@crown and mountainV2:mountain-road |
| MAJOR | obstruction | 1286 | [1327, 158.1, 471.3] | 2.5 m from centre | static | tower/support crownLaunch.columns@crown inside the carriageway at 2.5 m from centre |
| MAJOR | contact | 1286–1286.5 | [1327.5, 158.2, 469.5] | 0.13 s | fwd/right+2 (3×) | in-lane contact with crownLaunch.columns@crown (tower/support) for 0.13 s, 4.3→3.8 m/s |
| MINOR | buried | 4–6 | [1593.5, 35.1, 787.4] | 0.149 m terrain above deck | static | visible terrain 0.149 m above the deck inside the carriageway over 4 m |
| MINOR | grade | 22–46 | [1571.5, 36, 791] | 9.52 % max | static | 24 m over 8 % (max 9.5 % per 10 m) |
| MINOR | grade | 44–212 | [1409.5, 51.9, 789.1] | 10.02 % max | static | 168 m over 8 % (max 10 % per 10 m) |
| MINOR | slow-corner | 321.5–333 | [1287.9, 55.6, 741.7] | 5.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.8 m, driver down to 5.0 m/s (cornerSpeed 8) |
| MINOR | lip | 336.2 | [1278.8, 55.3, 733.1] | 0.083 m step | static | step up 0.08 m terrain → yearWalk.shoulders.lakeside@lakeside on lines -2.62 m |
| MINOR | unguarded-step | 342 | [1281.6, 55.1, 727.4] | 0.56 m drop | static | left edge: 0.56 m step off at 3.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | lip | 344.9 | [1279.1, 54.7, 724.3] | -0.131 m step | static | step down 0.13 m S1.batter@lakeside → yearWalk.bed.lakeside@lakeside on lines -2.62 m |
| MINOR | surface-mismatch | 348.5–350 | [1283.5, 55, 719.9] | 0.37 m vs bed | fwd/right+2 | rode above the bed line by 0.37 m on yearWalk.batter@lakeside |
| MINOR | planting | 361.5 | [1273.9, 55.9, 708.4] | 6.47 m from centre | static | Mountain v2 shrub:hedge shrub within 1 m of the carriageway edge (6.47 m from centre) |
| MINOR | planting | 362 | [1286.8, 55.9, 707.9] | 6.44 m from centre | static | Mountain v2 shrub:hedge shrub within 1 m of the carriageway edge (6.44 m from centre) |
| MINOR | unguarded-step | 440 | [1344, 61.7, 699] | 0.52 m drop | static | left edge: 0.52 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | slow-corner | 470–489.5 | [1372.1, 64.7, 685.1] | 6.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 6.8 m, driver down to 0.0 m/s (cornerSpeed 8) |
| MINOR | verge-drop | 506 | [1356.9, 66.3, 682] | 1.26 m drop | static | left: 1.26 m drop 7.75 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | scenery | 520 | [1342.9, 67.6, 681.7] | 3.2 m from centre | static | tunnel/roof oreTunnel.roof@undercroft inside the carriageway (3.2 m from centre, lowest face 3 m above the deck) |
| MINOR | slow-corner | 530.5–553 | [1333.2, 68.7, 678.5] | 5.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.9 m, driver down to 4.9 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 543.5 | [1328.2, 69.8, 668.2] | -0.118 m | rev/centre | step down 0.12 m between mountainV2:mountain-road and mountainV2:orchard-lane |
| MINOR | lip | 544 | [1328.3, 70, 667.7] | 0.121 m step | static | step up 0.12 m mountainV2:orchard-lane → mountainV2:mountain-road on lines 0 m |
| MINOR | lip | 545.7 | [1326.7, 70.1, 664] | -0.122 m step | static | step down 0.12 m mountainV2:orchard-lane → mountainV2:mountain-road on lines -3.6 m |
| MINOR | scenery | 546 | [1329.5, 70.2, 666.1] | 5.8 m from centre | static | mountainV2/dynamic mountainV2:orchard-lane:right:bridge:7:0 within 1 m of it (5.8 m from centre, lowest face 0.5 m above the deck) |
| MINOR | verge-drop | 562 | [1344.6, 71.7, 663] | 1.3 m drop | static | right: 1.3 m drop 7.5 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 566–568 | [1350.6, 72.3, 663.5] | 1.97 m drop | static | right: 1.97 m drop 7 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 570 | [1352.5, 72.5, 663.8] | 0.88 m drop | static | right edge: 0.88 m step off at 5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | buried | 576 | [1358.6, 73.2, 666.2] | 0.054 m terrain above deck | static | visible terrain 0.054 m above the deck inside the carriageway over 2 m (Mountain v2 ground) |
| MINOR | slow-corner | 659.5–677 | [1389.2, 85.6, 598.1] | 14.7 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | tight curve: radius 14.7 m, driver down to 7.7 m/s (cornerSpeed 8) |
| MINOR | planting | 685.5 | [1378.6, 87.4, 606.9] | 6.36 m from centre | static | Mountain v2 shrub:shrub shrub within 1 m of the carriageway edge (6.36 m from centre) |
| MINOR | slow-corner | 696–700.5 | [1366.9, 88.8, 604.8] | 13.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 13.8 m, driver down to 7.4 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 725.5–742.5 | [1341.5, 92.9, 594.3] | 11.5 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | hairpin: radius 11.5 m, driver down to 6.8 m/s (cornerSpeed 8) |
| MINOR | scenery | 734 | [1339.2, 94, 586.1] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:386:0 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 738–740 | [1338.1, 94.4, 582.4] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:391:0 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 742 | [1335.2, 94.8, 579.7] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:path:stair:rim-steps within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 750 | [1328, 95.4, 576.3] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:0 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 752 | [1326.1, 95.5, 575.7] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:2 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 756 | [1322.2, 95.8, 574.5] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:6 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 762 | [1316.5, 96.2, 572.9] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:12 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 764 | [1314.5, 96.3, 572.4] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:14 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 766 | [1312.6, 96.4, 572] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:16 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 768 | [1310.6, 96.5, 571.7] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:18 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 770 | [1308.6, 96.7, 571.5] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:20 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 774 | [1304.6, 96.9, 571.2] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:24 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 794 | [1285.1, 98.8, 567.6] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:44 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 796 | [1283.2, 99, 566.9] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:46 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 798 | [1281.4, 99.3, 566.1] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:48 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 800 | [1279.5, 99.5, 565.4] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:50 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 812–814 | [1267.7, 101.2, 564.3] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:path:stair:meadow-steps-1 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 816 | [1263.8, 101.7, 565.1] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:path:stair:meadow-steps-2 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | slow-corner | 867–867.5 | [1215.2, 108.8, 565.8] | 15.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.9 m, driver down to 8.0 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 882–885 | [1208.1, 110.9, 553.1] | 15.2 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.2 m, driver down to 7.8 m/s (cornerSpeed 8) |
| MINOR | verge-drop | 1040–1042 | [1346.7, 127.6, 551] | 1.41 m drop | static | right: 1.41 m drop 6.75 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | scenery | 1046 | [1352.6, 128.5, 551.8] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:702:0 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | unguarded-step | 1060 | [1366.1, 130.6, 555.5] | 0.87 m drop | static | left edge: 0.87 m step off at 5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | slow-corner | 1103.5–1107.5 | [1397.1, 137.1, 534.4] | 14.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.8 m, driver down to 7.7 m/s (cornerSpeed 8) |
| MINOR | scenery | 1132 | [1379.4, 141.3, 514.2] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:wall:790:0 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | slow-corner | 1132–1133.5 | [1379.6, 141.3, 514.2] | 15.1 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.1 m, driver down to 7.8 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1153–1172.5 | [1359.1, 144.2, 511.2] | 7.1 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 7.1 m, driver down to 5.3 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 1156.5 | [1355.7, 144.5, 509.8] | -0.119 m | rev/centre | step down 0.12 m between mountainV2:mountain-road and mountainV2:dam-promenade |
| MINOR | lip | 1157 | [1354.2, 144.7, 510.5] | 0.091 m step | static | step up 0.09 m mountainV2:dam-promenade → mountainV2:mountain-road on lines -1.8 m |
| MINOR | slow-corner | 1202.5–1228.5 | [1385.4, 150.1, 489.2] | 5.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.8 m, driver down to 4.8 m/s (cornerSpeed 8) |
| MINOR | lip | 1214.9 | [1389.3, 151.5, 480.4] | 0.137 m step | static | step up 0.14 m mountainV2:mountain-road → mountainV2:mountain-road on lines -3.6 m |
| MINOR | verge-drop | 1238 | [1373.4, 153.7, 472] | 1.35 m drop | static | left: 1.35 m drop 7.75 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | grade | 1276–1286 | [1336.4, 157.4, 474.8] | 8.41 % max | static | 10 m over 8 % (max 8.4 % per 10 m) |

## Structure transitions

| Structure | End | Road | Station | Structure bed y | Road bed y | Δ | Lips > 0.08 (±15 m, 5 lines) | Worst |
|---|---|---|---:|---:|---:|---:|---:|---|
| structure.mountainRoadCanalBridge | start | mountain-chain | 298.5 | 55.9 | 55.9 | 0 | 0 | — |
| structure.mountainRoadCanalBridge | end | mountain-chain | 316.5 | 55.77 | 55.77 | 0 | 0 | — |

## Junctions (threshold crossings)

| Crossing | Road | Other | Station | Lips > 0.08 | Worst |
|---|---|---|---:|---:|---|

## Pads touching a road

| Pad | Kind | Road | Station | Pad top | Road bed | Lips | Worst |
|---|---|---|---:|---:|---:|---:|---|
| station.jan | station | mountain-chain | 585.5 | 73.2 | 74.29 | 1 | BLOCKER: step up 0.75 m terrain → station.jan.slab@crown @ [1352.8, 73.2, 656.9] |

## Limits of this audit

- Board, bicycle and walker bodies are not driven here (their kernels treat 0.10–0.12 m as a wall); only the cruiser.
- Visual-only checks (markings, lighting, texture) are out of scope; `scenery` covers collision solids and v2 planting positions only. Horizon land has no planting of its own in this bake.
- The Mountain v2 provider is registered always-drawn (`provider`), as the ride tests do; at runtime its decks answer only while its scene is drawn.
- The driver is scripted: a human steers differently. Contacts on the +2 m lane on narrow stretches are expected physics, graded by whether the rider was still inside the carriageway.
- Only the cruiser's own collision queries are used; the camera (`cameraBlocked`) and visual pop-in are not audited.
- Debug aids: `--trace <bed>:<fwd|rev>:<0|2>:<from>:<to>` prints every step of one pass in a station window; `--probe-line x0,z0,x1,z1,y` prints the surface every 0.1 m along a line and the lips found.
