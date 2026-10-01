# Horizon road audit — before

Driver's-eye audit of the committed bake with the real cruiser sim (`stepCruiser`, CRUISER.dt = 1/120 s). Read-only: nothing under `src/` or `public/` was changed.

- Command: `node scripts/horizon/road-audit.mjs --mountain-chain --no-static --out docs/horizon/evidence/mountain-road/before/chain` (from the repo root)
- Checkout: `324cd5f246ab295af5cf64d553ebf78fad57f7b5`; world `public/horizon/world/horizon-geo-1.json.gz` sha256 `6c3ce551b69ca2c9…`, terrain sha256 `7fbbe1bae4867b07…` (horizon-geo-1)
- Wall-clock: **36.8 s** on 8 CPUs (v24.21.0); generated 2026-09-30T11:22:58.035Z
- Roads: mountain-chain

**Scope:** drive enabled; static sweep disabled. The synthetic mountain chain is a variable-width drive-only probe; the generic static-method description below does not mean those scans ran. Endpoint completion after restarts is not uninterrupted acceptance.

## Method

- **World**: `parseHorizonDefinition(horizon-geo-1.json.gz)` + `decodeTerrainAsset(bin,'full')` + `createHorizonGeography(field,{...collision, solids, diagnostics})` + `addDynamic(createMountainV2Region(...).provider)` — the loader of `test/horizonRideSituations.test.ts`.
- **Drive**: pure pursuit (lookahead 6–8 m) on the lane line; target speed = min(16, √(4/κ)) braked back at 5 m/s²; throttle/coast/brake only through `stepCruiser` inputs; no snapping. Passes: forward and reverse, centreline and keep-right +2 m (5 m-wide spurs: centreline only). V01 is driven round the whole loop (+10 m). A stall longer than 2 s, or leaving the corridor (> half-width + shoulder + 5 m, or 4 m below the bed), is logged and the drive restarts 6–8 m further on (listed per pass).
- **Static** (every 2 m station, no driving): *lateral scan* both sides in 0.25 m steps from the centreline at the deck height — `geography.contact` (r 0.2) at the rider's body band, surface continuity (±0.5 m), water, > 40°, or no ground; a transverse crack between segment prisms (deck continues 0.15 m either side along the road, or within 0.6 m further out) is stepped over, not an edge → usable width, drop depth beyond the first edge. *Missing guard* = a drop > 1.25 m that starts within the bed edge + 1.5 m with no rail/wall stopping the scan first (drops further out are listed as MINOR `verge-drop`). *Unguarded step* = 0.5–1.25 m drop at the edge. *Buried* = visible terrain above the deck at five points across the carriageway (skipped under a roof whose underside is below that terrain). *Floating edge* = deck-edge bottom (deck − 0.6 m) more than 0.3 m above the terrain 0.3 m outside the edge with no wall/rail/support solid below it (not on structures). *Headroom* = every downward-facing static face whose plan falls inside the carriageway box of that station with its underside 0.1–5 m above the deck (this road's own parapet coping excluded), plus the dynamic (Mountain v2) ceiling. *Kerbs* = own kerb solid at ±half-width. *Scenery* = non-walkable static solids not belonging to the road, and v2 dynamic solids, within the carriageway + 1 m, 0.3–4.5 m above the deck.
- **Lips** (every 0.1 m along five lines at 0, ±0.375, ±0.75 × half-width, interpolated so a line never cuts a corner): step in the physical surface with the local grade removed, > 0.08 m. A run of steps that returns to its starting height within 0.6 m is one *crack* (gap) or *ridge* — the 1.12 m wheelbase bridges a crack ≤ 0.3 m wide, so such a crack is MAJOR only when deeper than groundSnap (a foot, a board wheel or the rider's centre can fall in), else MINOR. *Junctions*: every threshold crossing of a road — the other route's bed ±20 m (to the road edge + 6 m) and the road ±15 m on three lines. *Pads*: every non-threshold pad within reach of a road — three lines from the road into 4 m inside the pad. *Transitions*: ±15 m on five lines at every structure-bed end within 12 m of a road. *v2 planting*: `mountainPlanting('full')` trees and shrubs kept where the region draws them, against every road (trunk inside the carriageway, within 1 m of it, or crown below 2.8 m over it).
- **Cross-reference**: every static finding lists the driving events (type:pass) within ±6 m of it, so "a lip exists" and "the cruiser felt it" stay separate facts.
- **Sampling**: nothing was sub-sampled beyond the steps above; the whole run took 36.8 s.
- **Severity**: BLOCKER = stops or launches the cruiser (stall, airborne > 0.1 s, lip up > 0.48 m or down > 0.55 m that is not a narrow crack, hole), buries it (terrain > 0.48 m over the deck), or headroom < 1.55 m. MAJOR = lip > 0.15 m, crack deeper than 0.55 m, missing guard over a > 1.25 m drop, usable width < 7 m (8 m roads) / < width − 0.5 m (5 m spurs), grade > 12 % per 10 m, contact while inside the carriageway, obstruction inside the carriageway at body height, buried 0.15–0.48 m, floating edge > 1 m, headroom < 5 m, v2 tree trunk in the carriageway, the Bight Bridge frame mismatch when V01's edge leaves the deck. MINOR otherwise.

## Totals

| Road | Length m | BLOCKER | MAJOR | MINOR | Drives (dir/lane: distance, restarts) | Kerb cover L/R |
|---|---:|---:|---:|---:|---|---|
| mountain-chain | 1288.2 | 5 | 22 | 22 | fwd/centre: 1287 m, 2r; fwd/right+2: 1287 m, 2r; rev/centre: 1287 m, 2r; rev/right+2: 1287 m, 1r | — |
| **all** | | **5** | **22** | **22** | | |

Issue counts are after merging the same driving event (same type and solid within 6 m) across passes and merging static stations into runs.

## Top issues (BLOCKER, then MAJOR; main roads first)

| # | Sev | Road | Station m | At [x, y, z] | Type | Cause | Seen by drives |
|---:|---|---|---|---|---|---|---|
| 1 | BLOCKER | mountain-chain | 675–678 | [1386.7, 87.6, 597.9] | airborne | launched 0.44 s at 7.7 m/s, 1.23 m drop, landing 5.3 m/s: lip mountainV2:library-balcony → mountainV2:mountain-road | fwd/centre |
| 2 | BLOCKER | mountain-chain | 977–970 | [1286.5, 123.9, 541.6] | airborne | launched 0.44 s at 16.0 m/s, 1.21 m drop, landing 5.3 m/s: lip mountainV2:dam-promenade → mountainV2:mountain-road | rev/right+2 |
| 3 | BLOCKER | mountain-chain | 333 | [1279.6, 55.3, 736.5] | stall | stalled against terrain (terrain/sim) | rev/right+2 |
| 4 | BLOCKER | mountain-chain | 352.5–353.5 | [1281.5, 54.9, 717] | stall | stalled against terrain (terrain/sim) | fwd/centre, fwd/right+2, rev/centre |
| 5 | BLOCKER | mountain-chain | 512.5–513 | [1350.5, 66.9, 682] | stall | stalled against low-headroom (low-headroom/sim) | fwd/centre, fwd/right+2, rev/centre |
| 6 | MAJOR | mountain-chain | 668–674.5 | [1386.7, 87.6, 597.9] | surface-mismatch | rode above the bed line by 1.72 m on mountainV2:library-balcony | fwd/centre, rev/centre |
| 7 | MAJOR | mountain-chain | 977–980.5 | [1286.5, 123.9, 541.6] | surface-mismatch | rode above the bed line by 0.69 m on mountainV2:dam-promenade | rev/right+2 |
| 8 | MAJOR | mountain-chain | 513–515 | [1349.8, 67.5, 682.3] | surface-mismatch | rode above the bed line by 0.54 m on oreStation.southPortal.slab@crown | rev/centre |
| 9 | MAJOR | mountain-chain | 346.5–351 | [1281.6, 55.2, 720] | surface-mismatch | rode above the bed line by 0.52 m on yearWalk.shoulders.lakeside@lakeside | fwd/centre |
| 10 | MAJOR | mountain-chain | 346.5–351.5 | [1279.5, 55.2, 720.3] | surface-mismatch | rode above the bed line by 0.52 m on yearWalk.bed.lakeside@lakeside | rev/right+2 |
| 11 | MAJOR | mountain-chain | 664–669 | [1392.2, 85.7, 599.1] | drive-lip | step up 0.48 m between mountainV2:mountain-road and mountainV2:library-balcony | rev/centre, rev/right+2 |
| 12 | MAJOR | mountain-chain | 977–980.5 | [1289.3, 123.8, 543] | drive-lip | step up 0.47 m between mountainV2:mountain-road and mountainV2:dam-promenade | fwd/centre, rev/centre, rev/right+2 |
| 13 | MAJOR | mountain-chain | 736–739 | [1339.6, 94.7, 583.5] | drive-lip | step up 0.47 m between mountainV2:mountain-road and mountainV2:library-balcony | fwd/centre, fwd/right+2, rev/right+2 |
| 14 | MAJOR | mountain-chain | 351 | [1281.5, 54.8, 718.2] | drive-lip | step down 0.40 m between yearWalk.shoulders.lakeside@lakeside and S1.surface.7.lakeside@lakeside | fwd/centre |
| 15 | MAJOR | mountain-chain | 351.5 | [1279.3, 55.2, 718.3] | drive-lip | step up 0.37 m between mountainV2:mountain-road and yearWalk.bed.lakeside@lakeside | rev/right+2 |
| 16 | MAJOR | mountain-chain | 348.5 | [1283.5, 55, 720.7] | drive-lip | step up 0.30 m between yearWalk.bed.lakeside@lakeside and yearWalk.batter@lakeside | fwd/right+2 |
| 17 | MAJOR | mountain-chain | 1154 | [1356.7, 144.3, 513] | drive-lip | step down 0.26 m between mountainV2:dam-promenade and mountainV2:mountain-road | rev/centre, rev/right+2 |
| 18 | MAJOR | mountain-chain | 351 | [1283.5, 54.8, 718.2] | drive-lip | step down 0.25 m between yearWalk.batter@lakeside and S1.surface.7.lakeside@lakeside | fwd/right+2 |
| 19 | MAJOR | mountain-chain | 560–563 | [1342.6, 71.8, 664.3] | drive-lip | step up 0.24 m between mountainV2:mountain-road and mountainV2:hearth-awning | fwd/centre, fwd/right+2, rev/centre |
| 20 | MAJOR | mountain-chain | 737–740 | [1338.1, 94.3, 583.4] | drive-lip | step down 0.23 m between mountainV2:library-balcony and mountainV2:mountain-road | fwd/right+2, rev/centre |
| 21 | MAJOR | mountain-chain | 560.5 | [1343, 71.6, 663.1] | drive-lip | step down 0.20 m between mountainV2:hearth-awning and mountainV2:mountain-road | rev/centre |
| 22 | MAJOR | mountain-chain | 540–544 | [1325.6, 69.6, 671.6] | drive-lip | step down 0.19 m between mountainV2:orchard-lane and mountainV2:mountain-road | fwd/centre, rev/right+2 |
| 23 | MAJOR | mountain-chain | 1285–1285.5 | [1328, 158.2, 471.8] | drive-lip | step up 0.17 m between mountainV2:mountain-road and threshold.skateLineStarts.1.slab@crown | fwd/centre, fwd/right+2 |
| 24 | MAJOR | mountain-chain | 1285–1286.5 | [1328, 158, 471.7] | drive-lip | step down 0.17 m between threshold.skateLineStarts.1.slab@crown and mountainV2:mountain-road | rev/centre, rev/right+2 |
| 25 | MAJOR | mountain-chain | 1212.5–1215.5 | [1390.4, 151.4, 480.1] | drive-lip | step down 0.17 m between mountainV2:mountain-road and mountainV2:mountain-road | rev/right+2 |
| 26 | MAJOR | mountain-chain | 343.5 | [1283, 55.1, 725.9] | drive-lip | step down 0.16 m between yearWalk.shoulders.lakeside@lakeside and S1.surface.7.lakeside@lakeside | fwd/right+2 |
| 27 | MAJOR | mountain-chain | 1286–1286.5 | [1327.5, 158.2, 469.5] | contact | in-lane contact with crownLaunch.columns@crown (tower/support) for 0.13 s, 4.3→3.8 m/s | fwd/right+2 |

## mountain-chain — 9.6 m bed, 1288.2 m

Drives: **fwd/centre** 1287 m in 118.7 s sim (mean 10.68 m/s, max 16), 476 contact steps, 53 airborne steps, restarts: stall terrain @352.5; stall low-headroom @512.5 · **fwd/right+2** 1287 m in 118.5 s sim (mean 10.7 m/s, max 16), 495 contact steps, 0 airborne steps, restarts: stall terrain @352.5; stall low-headroom @512.5 · **rev/centre** 1287 m in 119.2 s sim (mean 10.64 m/s, max 16), 482 contact steps, 0 airborne steps, restarts: stall low-headroom @513; stall terrain @353.5 · **rev/right+2** 1287 m in 115.8 s sim (mean 11.02 m/s, max 16), 211 contact steps, 53 airborne steps, restarts: stall terrain @333

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 333 | [1279.6, 55.3, 736.5] | —  | rev/right+2 | stalled against terrain (terrain/sim) |
| BLOCKER | stall | 352.5–353.5 | [1281.5, 54.9, 717] | —  | fwd/centre, fwd/right+2, rev/centre (3×) | stalled against terrain (terrain/sim) |
| BLOCKER | stall | 512.5–513 | [1350.5, 66.9, 682] | —  | fwd/centre, fwd/right+2, rev/centre (3×) | stalled against low-headroom (low-headroom/sim) |
| BLOCKER | airborne | 675–678 | [1386.7, 87.6, 597.9] | 1.23 m drop | fwd/centre | launched 0.44 s at 7.7 m/s, 1.23 m drop, landing 5.3 m/s: lip mountainV2:library-balcony → mountainV2:mountain-road |
| BLOCKER | airborne | 977–970 | [1286.5, 123.9, 541.6] | 1.21 m drop | rev/right+2 | launched 0.44 s at 16.0 m/s, 1.21 m drop, landing 5.3 m/s: lip mountainV2:dam-promenade → mountainV2:mountain-road |
| MAJOR | drive-lip | 343.5 | [1283, 55.1, 725.9] | -0.156 m | fwd/right+2 | step down 0.16 m between yearWalk.shoulders.lakeside@lakeside and S1.surface.7.lakeside@lakeside |
| MAJOR | surface-mismatch | 346.5–351 | [1281.6, 55.2, 720] | 0.52 m vs bed | fwd/centre | rode above the bed line by 0.52 m on yearWalk.shoulders.lakeside@lakeside |
| MAJOR | surface-mismatch | 346.5–351.5 | [1279.5, 55.2, 720.3] | 0.52 m vs bed | rev/right+2 | rode above the bed line by 0.52 m on yearWalk.bed.lakeside@lakeside |
| MAJOR | drive-lip | 348.5 | [1283.5, 55, 720.7] | 0.296 m | fwd/right+2 | step up 0.30 m between yearWalk.bed.lakeside@lakeside and yearWalk.batter@lakeside |
| MAJOR | drive-lip | 351 | [1281.5, 54.8, 718.2] | -0.395 m | fwd/centre | step down 0.40 m between yearWalk.shoulders.lakeside@lakeside and S1.surface.7.lakeside@lakeside |
| MAJOR | drive-lip | 351 | [1283.5, 54.8, 718.2] | -0.25 m | fwd/right+2 | step down 0.25 m between yearWalk.batter@lakeside and S1.surface.7.lakeside@lakeside |
| MAJOR | drive-lip | 351.5 | [1279.3, 55.2, 718.3] | 0.369 m | rev/right+2 | step up 0.37 m between mountainV2:mountain-road and yearWalk.bed.lakeside@lakeside |
| MAJOR | surface-mismatch | 513–515 | [1349.8, 67.5, 682.3] | 0.54 m vs bed | rev/centre | rode above the bed line by 0.54 m on oreStation.southPortal.slab@crown |
| MAJOR | drive-lip | 540–544 | [1325.6, 69.6, 671.6] | -0.189 m | fwd/centre, rev/right+2 (2×) | step down 0.19 m between mountainV2:orchard-lane and mountainV2:mountain-road |
| MAJOR | drive-lip | 560–563 | [1342.6, 71.8, 664.3] | 0.245 m | fwd/centre, fwd/right+2, rev/centre (3×) | step up 0.24 m between mountainV2:mountain-road and mountainV2:hearth-awning |
| MAJOR | drive-lip | 560.5 | [1343, 71.6, 663.1] | -0.202 m | rev/centre | step down 0.20 m between mountainV2:hearth-awning and mountainV2:mountain-road |
| MAJOR | drive-lip | 664–669 | [1392.2, 85.7, 599.1] | 0.482 m | rev/centre, rev/right+2 (2×) | step up 0.48 m between mountainV2:mountain-road and mountainV2:library-balcony |
| MAJOR | surface-mismatch | 668–674.5 | [1386.7, 87.6, 597.9] | 1.72 m vs bed | fwd/centre, rev/centre (3×) | rode above the bed line by 1.72 m on mountainV2:library-balcony |
| MAJOR | drive-lip | 736–739 | [1339.6, 94.7, 583.5] | 0.469 m | fwd/centre, fwd/right+2, rev/right+2 (4×) | step up 0.47 m between mountainV2:mountain-road and mountainV2:library-balcony |
| MAJOR | drive-lip | 737–740 | [1338.1, 94.3, 583.4] | -0.232 m | fwd/right+2, rev/centre (2×) | step down 0.23 m between mountainV2:library-balcony and mountainV2:mountain-road |
| MAJOR | drive-lip | 977–980.5 | [1289.3, 123.8, 543] | 0.473 m | fwd/centre, rev/centre, rev/right+2 (3×) | step up 0.47 m between mountainV2:mountain-road and mountainV2:dam-promenade |
| MAJOR | surface-mismatch | 977–980.5 | [1286.5, 123.9, 541.6] | 0.69 m vs bed | rev/right+2 | rode above the bed line by 0.69 m on mountainV2:dam-promenade |
| MAJOR | drive-lip | 1154 | [1356.7, 144.3, 513] | -0.261 m | rev/centre, rev/right+2 (2×) | step down 0.26 m between mountainV2:dam-promenade and mountainV2:mountain-road |
| MAJOR | drive-lip | 1212.5–1215.5 | [1390.4, 151.4, 480.1] | -0.169 m | rev/right+2 (2×) | step down 0.17 m between mountainV2:mountain-road and mountainV2:mountain-road |
| MAJOR | drive-lip | 1285–1285.5 | [1328, 158.2, 471.8] | 0.172 m | fwd/centre, fwd/right+2 (2×) | step up 0.17 m between mountainV2:mountain-road and threshold.skateLineStarts.1.slab@crown |
| MAJOR | drive-lip | 1285–1286.5 | [1328, 158, 471.7] | -0.17 m | rev/centre, rev/right+2 (2×) | step down 0.17 m between threshold.skateLineStarts.1.slab@crown and mountainV2:mountain-road |
| MAJOR | contact | 1286–1286.5 | [1327.5, 158.2, 469.5] | 0.13 s | fwd/right+2 (3×) | in-lane contact with crownLaunch.columns@crown (tower/support) for 0.13 s, 4.3→3.8 m/s |
| MINOR | slow-corner | 321.5–333 | [1279.6, 55.3, 736.2] | 6.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 6.9 m, driver down to 0.0 m/s (cornerSpeed 8) |
| MINOR | surface-mismatch | 348.5–350 | [1283.5, 55, 719.9] | 0.37 m vs bed | fwd/right+2 | rode above the bed line by 0.37 m on yearWalk.batter@lakeside |
| MINOR | slow-corner | 470–489.5 | [1373, 62.9, 698] | 6.6 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 6.6 m, driver down to 5.1 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 481.5–484.5 | [1375.4, 64.1, 687.6] | -0.123 m | rev/right+2 (2×) | step down 0.12 m between mountainV2:mountain-road and mountainV2:mountain-road |
| MINOR | slow-corner | 530.5–553 | [1333.2, 68.7, 678.6] | 5.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.9 m, driver down to 4.9 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 538–543.5 | [1329.6, 69.8, 670.6] | 0.149 m | fwd/right+2, rev/centre (3×) | step up 0.15 m between mountainV2:mountain-road and mountainV2:mountain-road |
| MINOR | slow-corner | 659.5–677 | [1389.2, 86.8, 598.1] | 14.7 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | tight curve: radius 14.7 m, driver down to 7.7 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 696–700.5 | [1366.9, 88.8, 604.8] | 13.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 13.8 m, driver down to 7.4 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 697 | [1365.5, 89, 603.2] | 0.083 m | fwd/right+2 | step up 0.08 m between mountainV2:mountain-road and mountainV2:mountain-road |
| MINOR | slow-corner | 725.5–742.5 | [1341.5, 92.9, 594.2] | 11.5 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | hairpin: radius 11.5 m, driver down to 6.8 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 730 | [1341.6, 93.5, 589.7] | 0.096 m | fwd/right+2 | step up 0.10 m between mountainV2:mountain-road and mountainV2:mountain-road |
| MINOR | surface-mismatch | 736.5–737 | [1339.6, 94.7, 583.5] | 0.45 m vs bed | fwd/right+2 | rode above the bed line by 0.45 m on mountainV2:library-balcony |
| MINOR | slow-corner | 867–867.5 | [1215.3, 108.8, 565.9] | 15.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.9 m, driver down to 8.0 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 882–885 | [1208.1, 110.9, 553.1] | 15.2 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.2 m, driver down to 7.8 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 977–980 | [1285.5, 123.2, 543.3] | -0.101 m | fwd/centre, rev/centre (2×) | step down 0.10 m between mountainV2:dam-promenade and mountainV2:mountain-road |
| MINOR | slow-corner | 1103.5–1107.5 | [1397.1, 137.1, 534.4] | 14.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.8 m, driver down to 7.7 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1132–1133.5 | [1379.6, 141.3, 514.2] | 15.1 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.1 m, driver down to 7.8 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 1134.5 | [1376.9, 141.7, 516.3] | -0.091 m | rev/right+2 | step down 0.09 m between mountainV2:mountain-road and mountainV2:mountain-road |
| MINOR | slow-corner | 1153–1172.5 | [1359.1, 144.2, 511.2] | 7.1 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 7.1 m, driver down to 5.3 m/s (cornerSpeed 8) |
| MINOR | drive-lip | 1155.5–1158.5 | [1355.7, 144.5, 509.8] | -0.117 m | fwd/right+2, rev/centre (3×) | step down 0.12 m between mountainV2:mountain-road and mountainV2:dam-promenade |
| MINOR | drive-lip | 1164.5–1167.5 | [1355.2, 146, 500.6] | 0.137 m | fwd/right+2 (2×) | step up 0.14 m between mountainV2:mountain-road and mountainV2:mountain-road |
| MINOR | slow-corner | 1202.5–1228.5 | [1385.4, 150.1, 489.2] | 5.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.8 m, driver down to 4.8 m/s (cornerSpeed 8) |

## Structure transitions

| Structure | End | Road | Station | Structure bed y | Road bed y | Δ | Lips > 0.08 (±15 m, 5 lines) | Worst |
|---|---|---|---:|---:|---:|---:|---:|---|

## Junctions (threshold crossings)

| Crossing | Road | Other | Station | Lips > 0.08 | Worst |
|---|---|---|---:|---:|---|

## Pads touching a road

| Pad | Kind | Road | Station | Pad top | Road bed | Lips | Worst |
|---|---|---|---:|---:|---:|---:|---|

## Limits of this audit

- Board, bicycle and walker bodies are not driven here (their kernels treat 0.10–0.12 m as a wall); only the cruiser.
- Visual-only checks (markings, lighting, texture) are out of scope; `scenery` covers collision solids and v2 planting positions only. Horizon land has no planting of its own in this bake.
- The Mountain v2 provider is registered always-drawn (`provider`), as the ride tests do; at runtime its decks answer only while its scene is drawn.
- The driver is scripted: a human steers differently. Contacts on the +2 m lane on narrow stretches are expected physics, graded by whether the rider was still inside the carriageway.
- Only the cruiser's own collision queries are used; the camera (`cameraBlocked`) and visual pop-in are not audited.
- Debug aids: `--trace <bed>:<fwd|rev>:<0|2>:<from>:<to>` prints every step of one pass in a station window; `--probe-line x0,z0,x1,z1,y` prints the surface every 0.1 m along a line and the lips found.
