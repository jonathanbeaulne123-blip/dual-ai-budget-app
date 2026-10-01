# Horizon road audit — before

Driver's-eye audit of the committed bake with the real cruiser sim (`stepCruiser`, CRUISER.dt = 1/120 s). Read-only: nothing under `src/` or `public/` was changed.

- Command: `node scripts/horizon/road-audit.mjs --mountain-chain --beds mountain-road --out /tmp/mountain-joined-ground-cruiser` (from the repo root)
- Checkout: `750150f887f96ba1fa991056f23fe3f66345a769`; world `public/horizon/world/horizon-geo-1.json.gz` sha256 `dd252b36ff5d5ded…`, terrain sha256 `908a33ea9a001144…` (horizon-geo-1)
- Wall-clock: **37.6 s** on 8 CPUs (v24.21.0); generated 2026-09-30T14:16:36.491Z
- Roads: mountain-chain

**Scope:** drive enabled; static sweep enabled. The mountain chain shares its source with the bake and varies width at each station. Endpoint completion after restarts is not uninterrupted acceptance.

## Method

- **World**: `parseHorizonDefinition(horizon-geo-1.json.gz)` + `decodeTerrainAsset(bin,'full')` + `createHorizonGeography(field,{...collision, solids, diagnostics})` + `addDynamic(createMountainV2Region(...).provider)` — the loader of `test/horizonRideSituations.test.ts`.
- **Drive**: pure pursuit (lookahead 6–8 m) on the lane line; target speed = min(16, √(4/κ)) braked back at 5 m/s²; throttle/coast/brake only through `stepCruiser` inputs; no snapping. Passes: forward and reverse, centreline and keep-right +2 m (5 m-wide spurs: centreline only). V01 is driven round the whole loop (+10 m). A stall longer than 2 s, or leaving the corridor (> half-width + shoulder + 5 m, or 4 m below the bed), is logged and the drive restarts 6–8 m further on (listed per pass).
- **Static** (every 2 m station, no driving): *lateral scan* both sides in 0.25 m steps from the centreline at the deck height — `geography.contact` (r 0.2) at the rider's body band, surface continuity (±0.5 m), water, > 40°, or no ground; a transverse crack between segment prisms (deck continues 0.15 m either side along the road, or within 0.6 m further out) is stepped over, not an edge → usable width, drop depth beyond the first edge. *Missing guard* = a drop > 1.25 m that starts within the bed edge + 1.5 m with no rail/wall stopping the scan first (drops further out are listed as MINOR `verge-drop`). *Unguarded step* = 0.5–1.25 m drop at the edge. *Buried* = visible terrain above the deck at five points across the carriageway (skipped under a roof whose underside is below that terrain). *Floating edge* = deck-edge bottom (deck − 0.6 m) more than 0.3 m above the terrain 0.3 m outside the edge with no wall/rail/support solid below it (not on structures). *Headroom* = every downward-facing static face whose plan falls inside the carriageway box of that station with its underside 0.1–5 m above the deck (this road's own parapet coping excluded), plus the dynamic (Mountain v2) ceiling. *Native owned guards* remain physical width limits and controller contacts; only duplicate scenery/obstruction labels are omitted when source endpoints, station, level and edge placement agree. Intrusions and adjacent road levels retain their findings. *Kerbs* = own kerb solid at ±half-width. *Scenery* = non-walkable static solids not belonging to the road, and v2 dynamic solids except verified same-station, same-level native edge guards, within the carriageway + 1 m, 0.3–4.5 m above the deck.
- **Lips** (every 0.1 m along five lines at 0, ±0.375, ±0.75 × half-width, interpolated so a line never cuts a corner): step in the physical surface with the local grade removed, > 0.08 m. A run of steps that returns to its starting height within 0.6 m is one *crack* (gap) or *ridge* — the 1.12 m wheelbase bridges a crack ≤ 0.3 m wide, so such a crack is MAJOR only when deeper than groundSnap (a foot, a board wheel or the rider's centre can fall in), else MINOR. *Junctions*: every threshold crossing of a road — the other route's bed ±20 m (to the road edge + 6 m) and the road ±15 m on three lines. *Pads*: every non-threshold pad within reach of a road — three lines from the road into 4 m inside the pad. *Transitions*: ±15 m on five lines at every structure-bed end within 12 m of a road. *v2 planting*: `mountainPlanting('full')` trees and shrubs kept where the region draws them, against every road (trunk inside the carriageway, within 1 m of it, or crown below 2.8 m over it).
- **Cross-reference**: every static finding lists the driving events (type:pass) within ±6 m of it, so "a lip exists" and "the cruiser felt it" stay separate facts.
- **Sampling**: nothing was sub-sampled beyond the steps above; the whole run took 37.6 s.
- **Severity**: BLOCKER = stops or launches the cruiser (stall, airborne > 0.1 s, lip up > 0.48 m or down > 0.55 m that is not a narrow crack, hole), buries it (terrain > 0.48 m over the deck), or headroom < 1.55 m. MAJOR = lip > 0.15 m, crack deeper than 0.55 m, missing guard over a > 1.25 m drop, usable width < 7 m (8 m roads) / < width − 0.5 m (5 m spurs), grade > 12 % per 10 m, contact while inside the carriageway, obstruction inside the carriageway at body height, buried 0.15–0.48 m, floating edge > 1 m, headroom < 5 m, v2 tree trunk in the carriageway, the Bight Bridge frame mismatch when V01's edge leaves the deck. MINOR otherwise.

## Totals

| Road | Length m | BLOCKER | MAJOR | MINOR | Drives (dir/lane: distance, restarts) | Kerb cover L/R |
|---|---:|---:|---:|---:|---|---|
| mountain-chain | 1289 | 2 | 49 | 40 | fwd/centre: 1287.5 m, 0r; fwd/right+2: 1287.5 m, 0r; rev/centre: 1287.5 m, 0r; rev/right+2: 1287.5 m, 2r | 0% / 0% |
| **all** | | **2** | **49** | **40** | | |

Issue counts are after merging the same driving event (same type and solid within 6 m) across passes and merging static stations into runs.

## Top issues (BLOCKER, then MAJOR; main roads first)

| # | Sev | Road | Station m | At [x, y, z] | Type | Cause | Seen by drives |
|---:|---|---|---|---|---|---|---|
| 1 | BLOCKER | mountain-chain | 483.5 | [1375.8, 64.1, 688] | stall | stalled against terrain (terrain/sim) | rev/right+2 |
| 2 | BLOCKER | mountain-chain | 1216 | [1390.5, 151.5, 480.2] | stall | stalled against terrain (terrain/sim) | rev/right+2 |
| 3 | MAJOR | mountain-chain | 350–398 | [1280.8, 56.6, 703.6] | grade | 48 m over 8 % (max 15.3 % per 10 m) — over the 12 % profile maximum | drive-lip:fwd/right+2, drive-lip:rev/right+2 |
| 4 | MAJOR | mountain-chain | 1016–1284 | [1354.1, 128.7, 552.2] | grade | 268 m over 8 % (max 15.1 % per 10 m) — over the 12 % profile maximum | drive-lip:rev/centre, stall:rev/right+2, drive-lip:rev/right+2 |
| 5 | MAJOR | mountain-chain | 470–750 | [1357.4, 90.2, 605.2] | grade | 280 m over 8 % (max 14.1 % per 10 m) — over the 12 % profile maximum | drive-lip:fwd/right+2, drive-lip:rev/centre, drive-lip:rev/right+2, stall:rev/right+2 |
| 6 | MAJOR | mountain-chain | 776–976 | [1264.2, 101.7, 564.9] | grade | 200 m over 8 % (max 14 % per 10 m) — over the 12 % profile maximum | — |
| 7 | MAJOR | mountain-chain | 418 | [1324.2, 61.3, 689.3] | scenery | mountainV2/dynamic mountainV2:path:stair:station-steps inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | — |
| 8 | MAJOR | mountain-chain | 542–544 | [1327.3, 69.8, 669.7] | scenery | mountainV2/dynamic mountainV2:orchard-lane inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | drive-lip:rev/right+2 |
| 9 | MAJOR | mountain-chain | 546 | [1329.3, 70.1, 666.3] | scenery | mountainV2/dynamic mountainV2:orchard-lane:right:bridge:7:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | drive-lip:rev/right+2 |
| 10 | MAJOR | mountain-chain | 1212–1216 | [1392, 151.1, 483.5] | scenery | mountainV2/dynamic mountainV2:mountain-road:left:parapet:873:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) | stall:rev/right+2 |
| 11 | MAJOR | mountain-chain | 378 | [1286.7, 58.4, 693.3] | obstruction | mountainV2/dynamic mountainV2:mountain-road:right:bridge:30:0 inside the carriageway at 4.75 m from centre | — |
| 12 | MAJOR | mountain-chain | 418 | [1324.2, 61.3, 689.3] | obstruction | mountainV2/dynamic mountainV2:path:stair:station-steps inside the carriageway at 4.75 m from centre | — |
| 13 | MAJOR | mountain-chain | 512 | [1351.1, 66.8, 682] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:parapet:164:0 inside the carriageway at 4.75 m from centre | drive-lip:fwd/right+2 |
| 14 | MAJOR | mountain-chain | 572 | [1354.3, 72.7, 663.9] | obstruction | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:0 inside the carriageway at 4.75 m from centre | — |
| 15 | MAJOR | mountain-chain | 704 | [1359.4, 89.9, 605.6] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:0 inside the carriageway at 4.75 m from centre | — |
| 16 | MAJOR | mountain-chain | 748 | [1330.2, 95.2, 577.2] | obstruction | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:0 inside the carriageway at 4.75 m from centre | — |
| 17 | MAJOR | mountain-chain | 732 | [1339.3, 93.7, 588.5] | obstruction | mountainV2/dynamic mountainV2:mountain-road:right:bridge:386:0 inside the carriageway at 4.5 m from centre | — |
| 18 | MAJOR | mountain-chain | 738 | [1338.4, 94.3, 582.6] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:bridge:383:6 inside the carriageway at 4.5 m from centre | — |
| 19 | MAJOR | mountain-chain | 966 | [1275.4, 122.3, 538.3] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:0 inside the carriageway at 4.5 m from centre | — |
| 20 | MAJOR | mountain-chain | 982 | [1289.7, 123.4, 545.3] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:0 inside the carriageway at 4.5 m from centre | — |
| 21 | MAJOR | mountain-chain | 1062 | [1367.6, 130.8, 555.7] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:parapet:717:0 inside the carriageway at 4.5 m from centre | — |
| 22 | MAJOR | mountain-chain | 1164 | [1352.7, 145.5, 503.7] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:parapet:821:0 inside the carriageway at 4.5 m from centre | — |
| 23 | MAJOR | mountain-chain | 1214–1218 | [1392.8, 151.3, 481.7] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:parapet:873:0 inside the carriageway at 4.5 m from centre | stall:rev/right+2 |
| 24 | MAJOR | mountain-chain | 1280 | [1333.4, 157.6, 473.6] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:parapet:899:38 inside the carriageway at 4.5 m from centre | — |
| 25 | MAJOR | mountain-chain | 1040 | [1346.2, 127.5, 551] | obstruction | mountainV2/dynamic mountainV2:path:stair:rim-steps inside the carriageway at 4.25 m from centre | — |
| 26 | MAJOR | mountain-chain | 1180 | [1362.8, 147.4, 493.1] | obstruction | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:8 inside the carriageway at 4.25 m from centre | — |
| 27 | MAJOR | mountain-chain | 1040 | [1346.2, 127.5, 551] | scenery | mountainV2/dynamic mountainV2:path:stair:rim-steps inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) | — |
| 28 | MAJOR | mountain-chain | 512–520 | [1345.1, 67.4, 681.9] | headroom | 2.91 m headroom under oreTunnel.roof@undercroft at 4.64 m from centre (profile clear 5 m; cruiser needs 1.55 m) | drive-lip:fwd/right+2 |
| 29 | MAJOR | mountain-chain | 714–716 | [1348.4, 91.6, 601] | missing-guard | left edge: 2.02 m drop at 5 m from centre with no guard (onto terrain) over 4 m | — |
| 30 | MAJOR | mountain-chain | 514–524 | [1347.1, 67.2, 682] | floating-edge | left deck edge hangs 1.71 m over the terrain with no retaining wall or parapet, over 12 m | drive-lip:fwd/right+2 |
| 31 | MAJOR | mountain-chain | 1044 | [1350.2, 128.1, 551.3] | missing-guard | right edge: 1.37 m drop at 6.25 m from centre with no guard (onto mountainV2:path:stair:rim-steps) over 2 m | — |
| 32 | MAJOR | mountain-chain | 712–716 | [1350.1, 91.3, 602.1] | floating-edge | left deck edge hangs 1.05 m over the terrain with no retaining wall or parapet, over 6 m | — |
| 33 | MAJOR | mountain-chain | 346.3–346.5 | [1283.1, 54.6, 723.2] | lip | step down 0.49 m yearWalk.batter@lakeside → spur stillwater.corridor.deck.1.lakeside@lakeside on lines 1.31, 2.63 m | drive-lip:fwd/right+2, drive-lip:rev/right+2 |
| 34 | MAJOR | mountain-chain | 346 | [1283.4, 54.6, 723.2] | drive-lip | step down 0.44 m between yearWalk.batter@lakeside and spur stillwater.corridor.deck.1.lakeside@lakeside | fwd/right+2 |
| 35 | MAJOR | mountain-chain | 341.8–343.9 | [1284.3, 55, 726.8] | lip | step up 0.39 m terrain → yearWalk.batter@lakeside on lines 2.63, -2.62, 1.31 m | drive-lip:fwd/right+2, drive-lip:rev/right+2 |
| 36 | MAJOR | mountain-chain | 540.4–541.2 | [1323.5, 70, 670] | lip | step up 0.37 m mountainV2:mountain-road → mountainV2:orchard-lane on lines -1.8, 3.6, -3.6 m | drive-lip:rev/right+2 |
| 37 | MAJOR | mountain-chain | 813–813.7 | [1266.6, 101.6, 560.8] | lip | step up 0.33 m mountainV2:mountain-road → mountainV2:path:stair:meadow-steps-1 on lines 3.6 m | — |
| 38 | MAJOR | mountain-chain | 1154.8–1155.1 | [1355.8, 144.7, 513.9] | lip | step up 0.29 m mountainV2:mountain-road → mountainV2:dam-promenade on lines -1.8, -3.6 m | drive-lip:rev/centre, drive-lip:rev/right+2 |
| 39 | MAJOR | mountain-chain | 1154.5–1155 | [1356.7, 144.3, 513] | drive-lip | step down 0.27 m between mountainV2:dam-promenade and mountainV2:mountain-road | rev/centre, rev/right+2 |
| 40 | MAJOR | mountain-chain | 559.5–560.8 | [1341.7, 71.7, 666.6] | lip | step up 0.24 m mountainV2:mountain-road → mountainV2:hearth-awning on lines 3.6, 1.8, 0 m | drive-lip:fwd/right+2, drive-lip:rev/centre |
| 41 | MAJOR | mountain-chain | 560.5 | [1342.7, 71.8, 664.3] | drive-lip | step up 0.24 m between mountainV2:mountain-road and mountainV2:hearth-awning | fwd/right+2 |
| 42 | MAJOR | mountain-chain | 512–516 | [1351.1, 67.1, 677.7] | buried | visible terrain 0.228 m above the deck inside the carriageway over 6 m | drive-lip:fwd/right+2 |
| 43 | MAJOR | mountain-chain | 344.5 | [1279.7, 54.8, 724.6] | drive-lip | step down 0.22 m between S1.batter@lakeside and yearWalk.bed.lakeside@lakeside | rev/right+2 |
| 44 | MAJOR | mountain-chain | 560.5 | [1342.9, 71.6, 663.1] | drive-lip | step down 0.21 m between mountainV2:hearth-awning and mountainV2:mountain-road | rev/centre |
| 45 | MAJOR | mountain-chain | 345 | [1279.7, 55, 724.4] | drive-lip | step up 0.19 m between yearWalk.bed.lakeside@lakeside and S1.batter@lakeside | rev/right+2 |
| 46 | MAJOR | mountain-chain | 510.1 | [1353, 66.8, 678.4] | lip | step up 0.19 m mountainV2:mountain-road → terrain on lines 3.6 m | drive-lip:fwd/right+2 |
| 47 | MAJOR | mountain-chain | 540.5 | [1325.5, 69.6, 671.2] | drive-lip | step down 0.18 m between mountainV2:orchard-lane and mountainV2:mountain-road | rev/right+2 |
| 48 | MAJOR | mountain-chain | 516.2–516.3 | [1346.9, 67.4, 680.2] | lip | step up 0.18 m mountainV2:mountain-road → oreTunnel.floor@undercroft on lines 1.8, 3.6 m | drive-lip:fwd/right+2 |
| 49 | MAJOR | mountain-chain | 338.8 | [1278.9, 55.2, 730.5] | lip | step up 0.17 m yearWalk.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside on lines -2.62 m | drive-lip:fwd/right+2, drive-lip:rev/right+2 |
| 50 | MAJOR | mountain-chain | 516 | [1347, 67.4, 679.9] | drive-lip | step up 0.16 m between oreStation.southPortal.slab@crown and oreTunnel.floor@undercroft | fwd/right+2 |
| 51 | MAJOR | mountain-chain | 343.5 | [1283, 55.2, 725.9] | drive-lip | step up 0.16 m between yearWalk.shoulders.lakeside@lakeside and yearWalk.batter@lakeside | fwd/right+2 |

## mountain-chain — 9.6 m bed, 1289 m

Drives: **fwd/centre** 1287.5 m in 115 s sim (mean 11.18 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 1287.5 m in 114.8 s sim (mean 11.19 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 1287.5 m in 115.1 s sim (mean 11.16 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/right+2** 1287.5 m in 118.3 s sim (mean 10.76 m/s, max 16), 475 contact steps, 0 airborne steps, restarts: stall terrain @1216; stall terrain @483.5

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 483.5 | [1375.8, 64.1, 688] | —  | rev/right+2 | stalled against terrain (terrain/sim) |
| BLOCKER | stall | 1216 | [1390.5, 151.5, 480.2] | —  | rev/right+2 | stalled against terrain (terrain/sim) |
| MAJOR | lip | 338.8 | [1278.9, 55.2, 730.5] | 0.173 m step | static | step up 0.17 m yearWalk.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside on lines -2.62 m |
| MAJOR | lip | 341.8–343.9 | [1284.3, 55, 726.8] | 0.386 m step | static | step up 0.39 m terrain → yearWalk.batter@lakeside on lines 2.63, -2.62, 1.31 m |
| MAJOR | drive-lip | 343.5 | [1283, 55.2, 725.9] | 0.16 m | fwd/right+2 | step up 0.16 m between yearWalk.shoulders.lakeside@lakeside and yearWalk.batter@lakeside |
| MAJOR | drive-lip | 344.5 | [1279.7, 54.8, 724.6] | -0.218 m | rev/right+2 | step down 0.22 m between S1.batter@lakeside and yearWalk.bed.lakeside@lakeside |
| MAJOR | drive-lip | 345 | [1279.7, 55, 724.4] | 0.194 m | rev/right+2 | step up 0.19 m between yearWalk.bed.lakeside@lakeside and S1.batter@lakeside |
| MAJOR | drive-lip | 346 | [1283.4, 54.6, 723.2] | -0.44 m | fwd/right+2 | step down 0.44 m between yearWalk.batter@lakeside and spur stillwater.corridor.deck.1.lakeside@lakeside |
| MAJOR | lip | 346.3–346.5 | [1283.1, 54.6, 723.2] | -0.485 m step | static | step down 0.49 m yearWalk.batter@lakeside → spur stillwater.corridor.deck.1.lakeside@lakeside on lines 1.31, 2.63 m |
| MAJOR | grade | 350–398 | [1280.8, 56.6, 703.6] | 15.26 % max | static | 48 m over 8 % (max 15.3 % per 10 m) — over the 12 % profile maximum |
| MAJOR | obstruction | 378 | [1286.7, 58.4, 693.3] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:30:0 inside the carriageway at 4.75 m from centre |
| MAJOR | obstruction | 418 | [1324.2, 61.3, 689.3] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:path:stair:station-steps inside the carriageway at 4.75 m from centre |
| MAJOR | scenery | 418 | [1324.2, 61.3, 689.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:path:stair:station-steps inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | grade | 470–750 | [1357.4, 90.2, 605.2] | 14.07 % max | static | 280 m over 8 % (max 14.1 % per 10 m) — over the 12 % profile maximum |
| MAJOR | lip | 510.1 | [1353, 66.8, 678.4] | 0.189 m step | static | step up 0.19 m mountainV2:mountain-road → terrain on lines 3.6 m |
| MAJOR | obstruction | 512 | [1351.1, 66.8, 682] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:164:0 inside the carriageway at 4.75 m from centre |
| MAJOR | buried | 512–516 | [1351.1, 67.1, 677.7] | 0.228 m terrain above deck | static | visible terrain 0.228 m above the deck inside the carriageway over 6 m |
| MAJOR | headroom | 512–520 | [1345.1, 67.4, 681.9] | 2.91 m clear | static | 2.91 m headroom under oreTunnel.roof@undercroft at 4.64 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| MAJOR | floating-edge | 514–524 | [1347.1, 67.2, 682] | 1.71 m gap | static | left deck edge hangs 1.71 m over the terrain with no retaining wall or parapet, over 12 m |
| MAJOR | drive-lip | 516 | [1347, 67.4, 679.9] | 0.161 m | fwd/right+2 | step up 0.16 m between oreStation.southPortal.slab@crown and oreTunnel.floor@undercroft |
| MAJOR | lip | 516.2–516.3 | [1346.9, 67.4, 680.2] | 0.176 m step | static | step up 0.18 m mountainV2:mountain-road → oreTunnel.floor@undercroft on lines 1.8, 3.6 m |
| MAJOR | lip | 540.4–541.2 | [1323.5, 70, 670] | 0.367 m step | static | step up 0.37 m mountainV2:mountain-road → mountainV2:orchard-lane on lines -1.8, 3.6, -3.6 m |
| MAJOR | drive-lip | 540.5 | [1325.5, 69.6, 671.2] | -0.179 m | rev/right+2 | step down 0.18 m between mountainV2:orchard-lane and mountainV2:mountain-road |
| MAJOR | scenery | 542–544 | [1327.3, 69.8, 669.7] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:orchard-lane inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | scenery | 546 | [1329.3, 70.1, 666.3] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:orchard-lane:right:bridge:7:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | lip | 559.5–560.8 | [1341.7, 71.7, 666.6] | 0.245 m step | static | step up 0.24 m mountainV2:mountain-road → mountainV2:hearth-awning on lines 3.6, 1.8, 0 m |
| MAJOR | drive-lip | 560.5 | [1342.7, 71.8, 664.3] | 0.242 m | fwd/right+2 | step up 0.24 m between mountainV2:mountain-road and mountainV2:hearth-awning |
| MAJOR | drive-lip | 560.5 | [1342.9, 71.6, 663.1] | -0.206 m | rev/centre | step down 0.21 m between mountainV2:hearth-awning and mountainV2:mountain-road |
| MAJOR | obstruction | 572 | [1354.3, 72.7, 663.9] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:parapet:224:0 inside the carriageway at 4.75 m from centre |
| MAJOR | obstruction | 704 | [1359.4, 89.9, 605.6] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:358:0 inside the carriageway at 4.75 m from centre |
| MAJOR | floating-edge | 712–716 | [1350.1, 91.3, 602.1] | 1.05 m gap | static | left deck edge hangs 1.05 m over the terrain with no retaining wall or parapet, over 6 m |
| MAJOR | missing-guard | 714–716 | [1348.4, 91.6, 601] | 2.02 m drop | static | left edge: 2.02 m drop at 5 m from centre with no guard (onto terrain) over 4 m |
| MAJOR | obstruction | 732 | [1339.3, 93.7, 588.5] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:386:0 inside the carriageway at 4.5 m from centre |
| MAJOR | obstruction | 738 | [1338.4, 94.3, 582.6] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:383:6 inside the carriageway at 4.5 m from centre |
| MAJOR | obstruction | 748 | [1330.2, 95.2, 577.2] | 4.75 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:right:bridge:401:0 inside the carriageway at 4.75 m from centre |
| MAJOR | grade | 776–976 | [1264.2, 101.7, 564.9] | 14.03 % max | static | 200 m over 8 % (max 14 % per 10 m) — over the 12 % profile maximum |
| MAJOR | lip | 813–813.7 | [1266.6, 101.6, 560.8] | 0.335 m step | static | step up 0.33 m mountainV2:mountain-road → mountainV2:path:stair:meadow-steps-1 on lines 3.6 m |
| MAJOR | obstruction | 966 | [1275.4, 122.3, 538.3] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:622:0 inside the carriageway at 4.5 m from centre |
| MAJOR | obstruction | 982 | [1289.7, 123.4, 545.3] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:bridge:637:0 inside the carriageway at 4.5 m from centre |
| MAJOR | grade | 1016–1284 | [1354.1, 128.7, 552.2] | 15.1 % max | static | 268 m over 8 % (max 15.1 % per 10 m) — over the 12 % profile maximum |
| MAJOR | obstruction | 1040 | [1346.2, 127.5, 551] | 4.25 m from centre | static | mountainV2/dynamic mountainV2:path:stair:rim-steps inside the carriageway at 4.25 m from centre |
| MAJOR | scenery | 1040 | [1346.2, 127.5, 551] | 4.2 m from centre | static | mountainV2/dynamic mountainV2:path:stair:rim-steps inside the carriageway (4.2 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | missing-guard | 1044 | [1350.2, 128.1, 551.3] | 1.37 m drop | static | right edge: 1.37 m drop at 6.25 m from centre with no guard (onto mountainV2:path:stair:rim-steps) over 2 m |
| MAJOR | obstruction | 1062 | [1367.6, 130.8, 555.7] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:717:0 inside the carriageway at 4.5 m from centre |
| MAJOR | drive-lip | 1154.5–1155 | [1356.7, 144.3, 513] | -0.267 m | rev/centre, rev/right+2 (2×) | step down 0.27 m between mountainV2:dam-promenade and mountainV2:mountain-road |
| MAJOR | lip | 1154.8–1155.1 | [1355.8, 144.7, 513.9] | 0.293 m step | static | step up 0.29 m mountainV2:mountain-road → mountainV2:dam-promenade on lines -1.8, -3.6 m |
| MAJOR | obstruction | 1164 | [1352.7, 145.5, 503.7] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:821:0 inside the carriageway at 4.5 m from centre |
| MAJOR | obstruction | 1180 | [1362.8, 147.4, 493.1] | 4.25 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:wall:829:8 inside the carriageway at 4.25 m from centre |
| MAJOR | scenery | 1212–1216 | [1392, 151.1, 483.5] | 4.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:873:0 inside the carriageway (4.8 m from centre, lowest face 0.5 m above the deck) |
| MAJOR | obstruction | 1214–1218 | [1392.8, 151.3, 481.7] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:873:0 inside the carriageway at 4.5 m from centre |
| MAJOR | obstruction | 1280 | [1333.4, 157.6, 473.6] | 4.5 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:899:38 inside the carriageway at 4.5 m from centre |
| MINOR | buried | 4–6 | [1593.5, 35.1, 787.4] | 0.149 m terrain above deck | static | visible terrain 0.149 m above the deck inside the carriageway over 4 m |
| MINOR | grade | 22–46 | [1571.5, 36, 791] | 9.52 % max | static | 24 m over 8 % (max 9.5 % per 10 m) |
| MINOR | grade | 44–212 | [1409.5, 51.9, 789.1] | 10.02 % max | static | 168 m over 8 % (max 10 % per 10 m) |
| MINOR | slow-corner | 321.5–333 | [1287.9, 55.6, 741.7] | 5.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.8 m, driver down to 5.0 m/s (cornerSpeed 8) |
| MINOR | lip | 336.2 | [1278.8, 55.3, 733.1] | 0.105 m step | static | step up 0.10 m terrain → yearWalk.shoulders.lakeside@lakeside on lines -2.62 m |
| MINOR | unguarded-step | 342 | [1281.6, 55.1, 727.4] | 0.56 m drop | static | left edge: 0.56 m step off at 3.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | lip | 344.9 | [1279.1, 54.7, 724.3] | -0.131 m step | static | step down 0.13 m S1.batter@lakeside → yearWalk.bed.lakeside@lakeside on lines -2.62 m |
| MINOR | lip | 349.5 | [1284.6, 54.6, 719.8] | -0.116 m step | static | step down 0.12 m yearWalk.bed.lakeside@lakeside → terrain on lines 2.63 m |
| MINOR | planting | 361.5 | [1273.9, 55.9, 708.4] | 6.47 m from centre | static | Mountain v2 shrub:hedge shrub within 1 m of the carriageway edge (6.47 m from centre) |
| MINOR | planting | 361.5 | [1286.8, 55.9, 707.9] | 6.46 m from centre | static | Mountain v2 shrub:hedge shrub within 1 m of the carriageway edge (6.46 m from centre) |
| MINOR | unguarded-step | 440 | [1343.9, 61.8, 699] | 0.52 m drop | static | left edge: 0.52 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | slow-corner | 470.5–489 | [1373.3, 62.9, 697.8] | 6.5 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 6.5 m, driver down to 5.1 m/s (cornerSpeed 8) |
| MINOR | verge-drop | 506 | [1357.1, 66.3, 682] | 1.27 m drop | static | left: 1.27 m drop 7.75 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | floating-edge | 510 | [1353.1, 66.7, 682] | 0.44 m gap | static | left deck edge hangs 0.44 m over the terrain with no retaining wall or parapet, over 2 m |
| MINOR | scenery | 520 | [1343.1, 67.6, 681.7] | 3.2 m from centre | static | tunnel/roof oreTunnel.roof@undercroft inside the carriageway (3.2 m from centre, lowest face 3 m above the deck) |
| MINOR | slow-corner | 530–553.5 | [1333.7, 68.6, 678.9] | 5.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.8 m, driver down to 4.8 m/s (cornerSpeed 8) |
| MINOR | floating-edge | 540 | [1327.1, 69.6, 671.6] | 0.33 m gap | static | left deck edge hangs 0.33 m over the terrain with no retaining wall or parapet, over 2 m |
| MINOR | unguarded-step | 542 | [1327.3, 69.8, 669.7] | 0.56 m drop | static | right edge: 0.56 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | lip | 545.9 | [1326.5, 70.1, 664] | -0.136 m step | static | step down 0.14 m mountainV2:orchard-lane → mountainV2:mountain-road on lines -3.6 m |
| MINOR | verge-drop | 562 | [1344.3, 71.7, 663] | 1.26 m drop | static | right: 1.26 m drop 7.5 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 566–568 | [1350.3, 72.3, 663.5] | 1.9 m drop | static | right: 1.9 m drop 7 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 570 | [1352.3, 72.5, 663.7] | 0.76 m drop | static | right edge: 0.76 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 570 | [1352.3, 72.5, 663.7] | 0.6 m gap | static | right deck edge hangs 0.6 m over the terrain with no retaining wall or parapet, over 2 m |
| MINOR | slow-corner | 660–677 | [1389, 85.7, 598] | 14.3 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | tight curve: radius 14.3 m, driver down to 7.6 m/s (cornerSpeed 8) |
| MINOR | planting | 686 | [1378.6, 87.4, 606.9] | 6.38 m from centre | static | Mountain v2 shrub:shrub shrub within 1 m of the carriageway edge (6.38 m from centre) |
| MINOR | slow-corner | 696.5–701 | [1366.8, 88.8, 604.9] | 13.2 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 13.2 m, driver down to 7.3 m/s (cornerSpeed 8) |
| MINOR | unguarded-step | 712 | [1351.9, 91, 603] | 1.21 m drop | static | left edge: 1.21 m step off at 5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | slow-corner | 726–743 | [1341.4, 92.9, 594.2] | 10.7 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | hairpin: radius 10.7 m, driver down to 6.6 m/s (cornerSpeed 8) |
| MINOR | scenery | 814 | [1266.2, 101.4, 564.5] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:path:stair:meadow-steps-1 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | scenery | 816 | [1264.2, 101.7, 564.9] | 5.2 m from centre | static | mountainV2/dynamic mountainV2:path:stair:meadow-steps-2 within 1 m of it (5.2 m from centre, lowest face 0.5 m above the deck) |
| MINOR | slow-corner | 867–869 | [1215.6, 108.8, 566.2] | 15.6 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.6 m, driver down to 7.9 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 882.5–886 | [1208.1, 110.9, 553.1] | 14.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.9 m, driver down to 7.7 m/s (cornerSpeed 8) |
| MINOR | verge-drop | 1042 | [1348.2, 127.8, 551] | 1.3 m drop | static | right: 1.3 m drop 6.5 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | slow-corner | 1104–1108.5 | [1397.1, 137.1, 534.4] | 14.5 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.5 m, driver down to 7.6 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1132–1134.5 | [1380.2, 141.2, 514.3] | 14.4 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.4 m, driver down to 7.6 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1154–1173 | [1358.6, 144.2, 511.1] | 7 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 7.0 m, driver down to 5.3 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1203–1229 | [1388.6, 152.2, 473.8] | 14.2 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | tight curve: radius 14.2 m, driver down to 7.5 m/s (cornerSpeed 8) |
| MINOR | scenery | 1214 | [1392.8, 151.3, 481.7] | 5.8 m from centre | static | mountainV2/dynamic mountainV2:mountain-road:left:parapet:873:2 within 1 m of it (5.8 m from centre, lowest face 0.5 m above the deck) |
| MINOR | lip | 1215 | [1389.4, 151.5, 480.6] | 0.095 m step | static | step up 0.09 m mountainV2:mountain-road → mountainV2:mountain-road on lines -3.6 m |
| MINOR | verge-drop | 1238–1240 | [1374.2, 153.6, 471.9] | 1.31 m drop | static | left: 1.31 m drop 7.75 m from centre (beyond the 4.8 m edge + 1.5 m verge; no guard needed by the bake rule) |

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
| station.jan | station | mountain-chain | 586 | 73.2 | 74.32 | 0 | — |

## Limits of this audit

- Board, bicycle and walker bodies are not driven here (their kernels treat 0.10–0.12 m as a wall); only the cruiser.
- Visual-only checks (markings, lighting, texture) are out of scope; `scenery` covers collision solids and v2 planting positions only. Horizon land has no planting of its own in this bake.
- The Mountain v2 provider is registered always-drawn (`provider`), as the ride tests do; at runtime its decks answer only while its scene is drawn.
- The driver is scripted: a human steers differently. Contacts on the +2 m lane on narrow stretches are expected physics, graded by whether the rider was still inside the carriageway.
- Only the cruiser's own collision queries are used; the camera (`cameraBlocked`) and visual pop-in are not audited.
- Debug aids: `--trace <bed>:<fwd|rev>:<0|2>:<from>:<to>` prints every step of one pass in a station window; `--probe-line x0,z0,x1,z1,y` prints the surface every 0.1 m along a line and the lips found.
