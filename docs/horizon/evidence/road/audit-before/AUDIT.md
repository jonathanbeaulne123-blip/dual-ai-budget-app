# Horizon road audit — before

Driver's-eye audit of the committed bake with the real cruiser sim (`stepCruiser`, CRUISER.dt = 1/120 s). Read-only: nothing under `src/` or `public/` was changed.

- Command: `node scripts/horizon/road-audit.mjs` (from `/home/claude/wt-audit`)
- Checkout: `ae277189b2fbc9b3bdaa41074948d41bcfa37747`; world `public/horizon/world/horizon-geo-1.json.gz` sha256 `e7548c75ed338c97…`, terrain sha256 `8f67205f2403378a…` (horizon-geo-1)
- Wall-clock: **81.3 s** on 2 CPUs (v22.22.2); generated 2026-09-29T06:43:05.937Z
- Roads: V01, VG, VBS, V03, spur upperStreet, spur library, spur glasshouse, spur studio, spur cottage, spur boathouse, plot.terraces.1.service, plot.terraces.2.service, plot.terraces.3.service, plot.bight.1.service, plot.bight.2.service, plot.bight.3.service, plot.bight.4.service

## Method

- **World**: `parseHorizonDefinition(horizon-geo-1.json.gz)` + `decodeTerrainAsset(bin,'full')` + `createHorizonGeography(field,{...collision, solids, diagnostics})` + `addDynamic(createMountainV2Region(...).provider)` — the loader of `test/horizonRideSituations.test.ts`.
- **Drive**: pure pursuit (lookahead 6–8 m) on the lane line; target speed = min(16, √(4/κ)) braked back at 5 m/s²; throttle/coast/brake only through `stepCruiser` inputs; no snapping. Passes: forward and reverse, centreline and keep-right +2 m (5 m-wide spurs: centreline only). V01 is driven round the whole loop (+10 m). A stall longer than 2 s, or leaving the corridor (> half-width + shoulder + 5 m, or 4 m below the bed), is logged and the drive restarts 6–8 m further on (listed per pass).
- **Static** (every 2 m station, no driving): *lateral scan* both sides in 0.25 m steps from the centreline at the deck height — `geography.contact` (r 0.2) at the rider's body band, surface continuity (±0.5 m), water, > 40°, or no ground; a transverse crack between segment prisms (deck continues 0.15 m either side along the road, or within 0.6 m further out) is stepped over, not an edge → usable width, drop depth beyond the first edge. *Missing guard* = a drop > 1.25 m that starts within the bed edge + 1.5 m with no rail/wall stopping the scan first (drops further out are listed as MINOR `verge-drop`). *Unguarded step* = 0.5–1.25 m drop at the edge. *Buried* = visible terrain above the deck at five points across the carriageway (skipped under a roof whose underside is below that terrain). *Floating edge* = deck-edge bottom (deck − 0.6 m) more than 0.3 m above the terrain 0.3 m outside the edge with no wall/rail/support solid below it (not on structures). *Headroom* = every downward-facing static face whose plan falls inside the carriageway box of that station with its underside 0.1–5 m above the deck (this road's own parapet coping excluded), plus the dynamic (Mountain v2) ceiling. *Kerbs* = own kerb solid at ±half-width. *Scenery* = non-walkable static solids not belonging to the road, and v2 dynamic solids, within the carriageway + 1 m, 0.3–4.5 m above the deck.
- **Lips** (every 0.1 m along five lines at 0, ±0.375, ±0.75 × half-width, interpolated so a line never cuts a corner): step in the physical surface with the local grade removed, > 0.08 m. A run of steps that returns to its starting height within 0.6 m is one *crack* (gap) or *ridge* — the 1.12 m wheelbase bridges a crack ≤ 0.3 m wide, so such a crack is MAJOR only when deeper than groundSnap (a foot, a board wheel or the rider's centre can fall in), else MINOR. *Junctions*: every threshold crossing of a road — the other route's bed ±20 m (to the road edge + 6 m) and the road ±15 m on three lines. *Pads*: every non-threshold pad within reach of a road — three lines from the road into 4 m inside the pad. *Transitions*: ±15 m on five lines at every structure-bed end within 12 m of a road. *v2 planting*: `mountainPlanting('full')` trees and shrubs kept where the region draws them, against every road (trunk inside the carriageway, within 1 m of it, or crown below 2.8 m over it).
- **Cross-reference**: every static finding lists the driving events (type:pass) within ±6 m of it, so "a lip exists" and "the cruiser felt it" stay separate facts.
- **Sampling**: nothing was sub-sampled beyond the steps above; the whole run took 81.3 s.
- **Severity**: BLOCKER = stops or launches the cruiser (stall, airborne > 0.1 s, lip up > 0.48 m or down > 0.55 m that is not a narrow crack, hole), buries it (terrain > 0.48 m over the deck), or headroom < 1.55 m. MAJOR = lip > 0.15 m, crack deeper than 0.55 m, missing guard over a > 1.25 m drop, usable width < 7 m (8 m roads) / < width − 0.5 m (5 m spurs), grade > 12 % per 10 m, contact while inside the carriageway, obstruction inside the carriageway at body height, buried 0.15–0.48 m, floating edge > 1 m, headroom < 5 m, v2 tree trunk in the carriageway, the Bight Bridge frame mismatch when V01's edge leaves the deck. MINOR otherwise.

## Totals

| Road | Length m | BLOCKER | MAJOR | MINOR | Drives (dir/lane: distance, restarts) | Kerb cover L/R |
|---|---:|---:|---:|---:|---|---|
| V01 | 3889.8 | 21 | 146 | 354 | fwd/centre: 3900 m, 1r; fwd/right+2: 3900 m, 4r; rev/centre: 3900 m, 0r; rev/right+2: 3900 m, 0r | 65% / 73% |
| VG | 1180.3 | 0 | 49 | 137 | fwd/centre: 1179 m, 0r; fwd/right+2: 1179 m, 0r; rev/centre: 1179 m, 0r; rev/right+2: 1179 m, 0r | 44% / 92% |
| VBS | 334.3 | 4 | 27 | 33 | fwd/centre: 333 m, 0r; rev/centre: 333 m, 0r | 0% / 71% |
| V03 | 327.4 | 1 | 19 | 22 | fwd/centre: 326 m, 0r; fwd/right+2: 326 m, 0r; rev/centre: 326 m, 0r; rev/right+2: 326 m, 0r | 4% / 95% |
| spur upperStreet | 20 | 0 | 3 | 2 | fwd/centre: 18.5 m, 0r; rev/centre: 18.5 m, 0r | 0% / 0% |
| spur library | 156.5 | 2 | 2 | 4 | fwd/centre: 155.5 m, 0r; rev/centre: 155.5 m, 0r | 80% / 72% |
| spur glasshouse | 50 | 4 | 3 | 3 | fwd/centre: 41.5 m (incomplete), 1r; rev/centre: 49 m, 1r | 81% / 85% |
| spur studio | 26 | 0 | 4 | 2 | fwd/centre: 24.5 m, 0r; rev/centre: 24.5 m, 0r | 57% / 50% |
| spur cottage | 70.7 | 0 | 4 | 15 | fwd/centre: 69.5 m, 0r; rev/centre: 69.5 m, 0r | 58% / 58% |
| spur boathouse | 36.4 | 3 | 6 | 2 | fwd/centre: 35 m, 1r; rev/centre: 31.5 m (incomplete), 1r | 58% / 58% |
| plot.terraces.1.service | 31.5 | 0 | 2 | 2 | fwd/centre: 30 m, 0r; rev/centre: 30 m, 0r | 25% / 25% |
| plot.terraces.2.service | 65.8 | 1 | 14 | 2 | fwd/centre: 64.5 m, 1r; rev/centre: 64.5 m, 1r | 21% / 21% |
| plot.terraces.3.service | 58.7 | 1 | 5 | 2 | fwd/centre: 57.5 m, 1r; rev/centre: 57.5 m, 1r | 0% / 0% |
| plot.bight.1.service | 68.3 | 1 | 4 | 2 | fwd/centre: 67 m, 1r; rev/centre: 67 m, 1r | 9% / 9% |
| plot.bight.2.service | 74.6 | 1 | 2 | 1 | fwd/centre: 73.5 m, 1r; rev/centre: 73.5 m, 1r | 39% / 39% |
| plot.bight.3.service | 84.2 | 1 | 4 | 1 | fwd/centre: 83 m, 1r; rev/centre: 83 m, 1r | 42% / 42% |
| plot.bight.4.service | 78.1 | 1 | 4 | 0 | fwd/centre: 77 m, 1r; rev/centre: 77 m, 1r | 35% / 35% |
| **all** | | **41** | **298** | **584** | | |

Issue counts are after merging the same driving event (same type and solid within 6 m) across passes and merging static stations into runs.

## Top issues (BLOCKER, then MAJOR; main roads first)

| # | Sev | Road | Station m | At [x, y, z] | Type | Cause | Seen by drives |
|---:|---|---|---|---|---|---|---|
| 1 | BLOCKER | V01 | 3255 | [1003.4, 3.1, 1392] | pad-lip | pad tidelinePark (place, top 3 vs road bed 5.12): 7 lips between the road and 4 m inside the pad; worst 5.1 m out from the road centre: step down 2.55 m V01.shoulders.landing@landing → terrain | — |
| 2 | BLOCKER | V01 | 331–325 | [1601.5, 31.9, 839.9] | airborne | launched 0.42 s at 15.9 m/s, 1.09 m drop, landing 5.0 m/s: deck/structure seam plot.terraces.1.layby.slab@prow → V01.bed.prow@prow | rev/centre, rev/right+2 |
| 3 | BLOCKER | V01 | 64 | [1463.7, 18.2, 1050.5] | pad-lip | pad town.upperStreet (place, top 18 vs road bed 19.13): 1 lips between the road and 4 m inside the pad; worst 5.1 m out from the road centre: step down 0.97 m V01.shoulders.harbour@harbour → terrain | — |
| 4 | BLOCKER | V01 | 3592–3594 | [1349.2, 9, 1346.3] | headroom | 0.96 m headroom under crossing.cross.s3.riverLower.1.rails@reach at 1.74 m from centre (profile clear 5 m; cruiser needs 1.55 m) | stall:fwd/right+2 |
| 5 | BLOCKER | V01 | 3550–3552 | [1318.6, 9, 1374] | headroom | 0.92 m headroom under S3.edges.reach@reach at 2.76 m from centre (profile clear 5 m; cruiser needs 1.55 m) | drive-lip:fwd/centre, drive-lip:fwd/right+2, drive-lip:rev/centre, drive-lip:rev/right+2 |
| 6 | BLOCKER | V01 | 131.8 | [1526.2, 17.4, 1021.6] | lip | step up 0.83 m terrain → yearWalk.bed.harbour@harbour on lines 3 m | contact:fwd/right+2 |
| 7 | BLOCKER | V01 | 3180 | [948.8, 3.9, 1379.3] | junction-lip | junction cross.v01.yearWalk.6 (V01 × yearWalk): 3 lips > 0.08 m; worst on other+ at 5.09 m: step down 0.72 m V01.bed.green@landing → yearWalk.bed.landing@landing | drive-lip:rev/right+2, surface-mismatch:rev/right+2 |
| 8 | BLOCKER | V01 | 324.5 | [1601.5, 31.9, 839.9] | transition | prowTunnel end: structure bed 30.82 vs road bed 30.87 (Δ -0.05 m, plan offset 0.02 m); 7 lips > 0.08 m within ±15 m, worst on line 0 m at 6.3 m: step up 0.61 m V01.bed.prow@prow → plot.terraces.1.layby.slab@prow | contact:fwd/centre, stall:fwd/centre |
| 9 | BLOCKER | V01 | 330.8–332 | [1601.5, 31.9, 839.9] | lip | step up 0.61 m V01.bed.prow@prow → plot.terraces.1.layby.slab@prow on lines 0, -1.5, -3 m | contact:fwd/centre, stall:fwd/centre, drive-lip:fwd/right+2, surface-mismatch:fwd/right+2, surface-mismatch:rev/centre, airborne:rev/right+2, surface-mismatch:rev/right+2 |
| 10 | BLOCKER | V01 | 124–134 | [1523.2, 16.3, 1024.1] | buried | visible terrain 0.565 m above the deck inside the carriageway over 12 m | contact:fwd/right+2 |
| 11 | BLOCKER | V01 | 376.1–376.2 | [1596.8, 35.2, 794.7] | lip | step up 0.54 m V01.bed.prow@prow → V03.bed.prow@prow on lines -1.5, -3 m | drive-lip:rev/right+2, surface-mismatch:rev/right+2 |
| 12 | BLOCKER | V01 | 380 | [1596.8, 35.2, 794.7] | junction-lip | junction cross.v01.v03.1 (V01 × V03): 1 lips > 0.08 m; worst on road-3 at -3.8 m: step up 0.54 m V01.bed.prow@prow → V03.bed.prow@prow | drive-lip:rev/right+2, surface-mismatch:rev/right+2 |
| 13 | BLOCKER | V01 | 502.3–503.9 | [1588.8, 45.5, 667.2] | lip | step up 0.51 m V01.bed.prow@prow → yearWalk.bed.prow@prow on lines -3, -1.5, 0, 1.5, 3 m | drive-lip:fwd/centre, contact:fwd/right+2, stall:fwd/right+2, drive-lip:rev/centre, drive-lip:rev/right+2 |
| 14 | BLOCKER | V01 | 506 | [1588.8, 45.5, 667.2] | junction-lip | junction cross.v01.yearWalk.2 (V01 × yearWalk): 5 lips > 0.08 m; worst on road+3 at -2.1 m: step up 0.51 m V01.bed.prow@prow → yearWalk.bed.prow@prow | drive-lip:fwd/centre, contact:fwd/right+2, stall:fwd/right+2, drive-lip:rev/centre, drive-lip:rev/right+2 |
| 15 | BLOCKER | V01 | 108–132 | [1521.3, 15.8, 1021.1] | headroom | 0.24 m headroom under yearWalk.bed.harbour@harbour at 3.49 m from centre (profile clear 5 m; cruiser needs 1.55 m) | contact:fwd/right+2 |
| 16 | BLOCKER | V01 | 2704–2766 | [616.5, 12, 1141.3] | headroom | 0.2 m headroom under bightBridge.s2Ramp.sea.deck@bight at 3.83 m from centre (profile clear 5 m; cruiser needs 1.55 m) | contact:fwd/right+2, stall:fwd/right+2 |
| 17 | BLOCKER | V01 | 330.5 | [1601.1, 31.3, 840.3] | stall | stalled against plot.terraces.1.layby.slab@prow (pad/floor) | fwd/centre |
| 18 | BLOCKER | V01 | 503 | [1588.2, 45, 668] | stall | stalled against yearWalk.bed.prow@prow (bed/deck) | fwd/right+2 |
| 19 | BLOCKER | V01 | 2716 | [573.4, 12, 1116.2] | stall | stalled against bightBridge.s2Ramp.sea.posts@bight (post/support) | fwd/right+2 |
| 20 | BLOCKER | V01 | 2726.5 | [582, 12, 1121.7] | stall | stalled against bightBridge.s2Ramp.sea.posts@bight (post/support) | fwd/right+2 |
| 21 | BLOCKER | V01 | 3592 | [1351.1, 9, 1347.2] | stall | stalled against low-headroom (low-headroom/sim) | fwd/right+2 |
| 22 | BLOCKER | V03 | 246–274 | [1342.9, 55.5, 769.3] | buried | visible terrain 0.556 m above the deck inside the carriageway over 30 m (Mountain v2 ground) | surface-mismatch:fwd/centre, surface-mismatch:fwd/right+2, surface-mismatch:rev/centre, surface-mismatch:rev/right+2 |
| 23 | BLOCKER | VBS | 6.5 | [948.3, 29.1, 861.3] | junction-lip | junction cross.vBS.yearWalk.1 (VBS × yearWalk): 2 lips > 0.08 m; worst on road+3 at 4.9 m: step down 0.87 m yearWalk.bed.lakeside@lakeside → terrain | surface-mismatch:fwd/centre, surface-mismatch:rev/centre |
| 24 | BLOCKER | VBS | 9.5 | [948.3, 29.1, 861.3] | junction-lip | junction cross.vBS.yearWalk.2 (VBS × yearWalk): 3 lips > 0.08 m; worst on road+3 at 1.9 m: step down 0.87 m yearWalk.bed.lakeside@lakeside → terrain | surface-mismatch:fwd/centre, drive-lip:fwd/centre, drive-lip:rev/centre, surface-mismatch:rev/centre |
| 25 | BLOCKER | VBS | 163.5 | [850.5, 19.5, 976.3] | junction-lip | junction cross.vBS.yearWalk.5 (VBS × yearWalk): 4 lips > 0.08 m; worst on road+3 at 3.7 m: step down 0.60 m yearWalk.shoulders.bight@bight → terrain | drive-lip:fwd/centre, drive-lip:rev/centre |
| 26 | BLOCKER | VBS | 136 | [864.6, 20.2, 952.1] | junction-lip | junction cross.vBS.plotBight1Service.1 (VBS × plot.bight.1.service): 4 lips > 0.08 m; worst on road+3 at 3.2 m: step down 0.58 m plot.bight.1.layby.slab@bight → terrain | drive-lip:fwd/centre, drive-lip:rev/centre |
| 27 | BLOCKER | spur glasshouse | 32–50 | [995.6, 45.2, 830.8] | buried | visible terrain 11.667 m above the deck inside the carriageway over 20 m | stall:fwd/centre, stall:rev/centre |
| 28 | BLOCKER | spur library | 112.5 | [809.8, 45.8, 332.2] | pad-lip | pad station.oct (station, top 45.5 vs road bed 46.77): 7 lips between the road and 4 m inside the pad; worst 2.6 m out from the road centre: step down 0.94 m spur library.bed.scholars@scholars → terrain | — |
| 29 | BLOCKER | spur library | 105 | [803.8, 46.1, 335.3] | junction-lip | junction cross.spurLibrary.yearWalk.1 (spur library × yearWalk): 6 lips > 0.08 m; worst on other+ at 2.86 m: step down 0.62 m spur library.bed.scholars@scholars → yearWalk.bed.scholars@scholars | — |
| 30 | BLOCKER | spur boathouse | 4–4.2 | [1300.7, 7.4, 1375.6] | lip | step down 0.58 m V01.bed.reach@reach → spur boathouse.bed.reach@reach on lines 0.94, 1.88, -0.94, 0, -1.87 m | drive-lip:fwd/centre, surface-mismatch:fwd/centre, stall:fwd/centre, contact:rev/centre, stall:rev/centre |
| 31 | BLOCKER | spur glasshouse | 41.5 | [993.4, 33, 835] | stall | stalled against terrain (terrain/sim) | fwd/centre |
| 32 | BLOCKER | spur glasshouse | 41.5 | [993.4, 33, 835] | incomplete | drive did not finish (42 of 49 m in 6 s) | fwd/centre |
| 33 | BLOCKER | spur glasshouse | 50 | [999.9, 34, 830.1] | stall | stalled against terrain (terrain/sim) | rev/centre |
| 34 | BLOCKER | spur boathouse | 4–4.5 | [1298.9, 7.4, 1376.1] | stall | stalled against V01.bed.landing@reach (bed/deck) | fwd/centre, rev/centre |
| 35 | BLOCKER | spur boathouse | 4.5 | [1298.8, 7.4, 1375.7] | incomplete | drive did not finish (32 of 35 m in 6 s) | rev/centre |
| 36 | BLOCKER | plot.terraces.2.service | 21–22.5 | [1567.6, 25.3, 901.9] | stall | stalled against plot.terraces.2.retaining@prow (retainingWall/wall) | fwd/centre, rev/centre |
| 37 | BLOCKER | plot.terraces.3.service | 13.5–14.5 | [1544.5, 20.7, 974.7] | stall | stalled against plot.terraces.3.retaining@prow (retainingWall/wall) | fwd/centre, rev/centre |
| 38 | BLOCKER | plot.bight.1.service | 25.5–27 | [853.3, 20.8, 930.6] | stall | stalled against plot.bight.1.retaining@bight (retainingWall/wall) | fwd/centre, rev/centre |
| 39 | BLOCKER | plot.bight.2.service | 32.5–34 | [812.8, 18.7, 986] | stall | stalled against plot.bight.2.retaining@bight (retainingWall/wall) | fwd/centre, rev/centre |
| 40 | BLOCKER | plot.bight.3.service | 41–42.5 | [758.5, 16, 1061.1] | stall | stalled against plot.bight.3.retaining@bight (retainingWall/wall) | fwd/centre, rev/centre |
| 41 | BLOCKER | plot.bight.4.service | 35–36.5 | [740.3, 14, 1128.4] | stall | stalled against plot.bight.4.retaining@bight (retainingWall/wall) | fwd/centre, rev/centre |
| 42 | MAJOR | V01 | 322–338 | [1601.1, 30.7, 848.7] | grade | 16 m over 8 % (max 12.4 % per 10 m) — over the 12 % profile maximum | contact:fwd/centre, stall:fwd/centre, drive-lip:fwd/right+2, surface-mismatch:fwd/right+2, airborne:rev/centre, surface-mismatch:rev/centre, airborne:rev/right+2, surface-mismatch:rev/right+2 |
| 43 | MAJOR | V01 | 94–118 | [1498.1, 16.5, 1032.7] | grade | 24 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum | — |
| 44 | MAJOR | V01 | 2424–2574 | [408.2, 26.1, 914.2] | grade | 150 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum | drive-lip:fwd/centre, drive-lip:fwd/right+2, drive-lip:rev/centre |
| 45 | MAJOR | V01 | 3778–3812 | [1362.9, 17.8, 1148.3] | grade | 34 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum | — |
| 46 | MAJOR | V01 | 3593.5 | [1350.5, 0.6, 1349.9] | junction-lip | junction cross.s3.v01.1 (V01 × S3): 2 lips > 0.08 m; worst on road+3 at -3.8 m: crack 8.36 m deep, 0.2 m wide between prisms (quayBridge.deck@reach \| terrain showing) | stall:fwd/right+2 |
| 47 | MAJOR | V01 | 3593.5 | [1350.5, 0.6, 1349.9] | junction-lip | junction cross.s3.v01.2 (V01 × S3): 2 lips > 0.08 m; worst on road+3 at -3.8 m: crack 8.36 m deep, 0.2 m wide between prisms (quayBridge.deck@reach \| terrain showing) | stall:fwd/right+2 |
| 48 | MAJOR | V01 | 2573.5–2818.5 | — | frame-mismatch | V01 spline vs the Bight Bridge straight frame: up to 7.16 m lateral at station 2643.5 (deck half-width 10.8, V01 edge 5) | contact:fwd/right+2, stall:fwd/right+2 |
| 49 | MAJOR | V01 | 2426 | [402.5, 28.4, 895.1] | missing-guard | left edge: 6.59 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m | drive-lip:fwd/centre, drive-lip:fwd/right+2, drive-lip:rev/centre |
| 50 | MAJOR | V01 | 2434–2540 | [405.3, 27.3, 904.7] | floating-edge | left deck edge hangs 6.4 m over the terrain with no retaining wall or parapet, over 108 m | — |
| 51 | MAJOR | V01 | 2430 | [403.6, 28, 898.9] | missing-guard | left edge: 5.96 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m | drive-lip:rev/centre |
| 52 | MAJOR | V01 | 134–144 | [1532.7, 17.2, 1013] | narrow | usable width 5.5 m (< 7): left blocker yearWalk.bed.notch@harbour at 3.75 m, right blocker yearWalk.bed.prow@harbour at 1.75 m | contact:fwd/right+2, drive-lip:fwd/right+2 |
| 53 | MAJOR | V01 | 2428–2430 | [403, 28.2, 897] | floating-edge | left deck edge hangs 5.3 m over the terrain with no retaining wall or parapet, over 4 m | drive-lip:fwd/centre, drive-lip:fwd/right+2, drive-lip:rev/centre |
| 54 | MAJOR | V01 | 2424 | [401.9, 28.3, 893.1] | missing-guard | right edge: 4.82 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m | drive-lip:fwd/centre, drive-lip:fwd/right+2, drive-lip:rev/centre |
| 55 | MAJOR | V01 | 3545.5 | [1323.3, 4.7, 1373.3] | transition | structure.quayBridge start: structure bed 9 vs road bed 8.77 (Δ 0.23 m, plan offset 0.03 m); 18 lips > 0.08 m within ±15 m, worst on line 1.5 m at 9 m: crack 4.27 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) | drive-lip:fwd/centre, drive-lip:fwd/right+2, drive-lip:rev/centre, drive-lip:rev/right+2 |
| 56 | MAJOR | V01 | 104–106 | [1499.9, 16.3, 1032] | obstruction | bed/deck yearWalk.bed.harbour@harbour inside the carriageway at 3.75 m from centre | — |
| 57 | MAJOR | V01 | 138–142 | [1529.6, 16.8, 1015.5] | obstruction | bed/deck yearWalk.bed.notch@harbour inside the carriageway at 3.75 m from centre | contact:fwd/right+2 |
| 58 | MAJOR | V01 | 2628–2630 | [501.4, 12, 1065.3] | obstruction | deckParapet/rail bightBridge.rails@bight inside the carriageway at 3.75 m from centre | — |
| 59 | MAJOR | V01 | 2662–2666 | [529.2, 12, 1084.8] | obstruction | deckParapet/rail bightBridge.rails@bight inside the carriageway at 3.75 m from centre | — |
| 60 | MAJOR | V01 | 3242–3250 | [1013.6, 5.6, 1388.7] | floating-edge | right deck edge hangs 3.51 m over the terrain with no retaining wall or parapet, over 10 m | — |

## V01 route character (derived from the 50 m bins below)

| Stations m | Character | Districts | Elevation m | Year Walk beside | Pads |
|---|---|---|---|---|---|
| 0–50 | open | harbour | 22.1–22.1 | — |  |
| 50–100 | developed | harbour | 18.5–18.5 | — | town.upperStreet |
| 100–200 | open | harbour | 15.3–19.8 | 2/2 bins | plot.terraces.3.layby |
| 200–350 | gallery | prow | 23.3–30.8 | 3/3 bins | plot.terraces.2.layby, plot.terraces.3.layby, station.nov, plot.terraces.1.apron, plot.terraces.1.layby |
| 350–550 | open | prow | 34.5–45.9 | 4/4 bins | plot.terraces.1.layby |
| 550–650 | coastal | prow | 49.4–53.2 | 2/2 bins |  |
| 650–1050 | coastal cliff | crown | 56.9–74.5 | 8/8 bins |  |
| 1050–1250 | coastal | crown | 61.2–70.3 | 4/4 bins |  |
| 1250–1500 | open | crown, scholars | 47–58.2 | 5/5 bins |  |
| 1500–1600 | developed | scholars | 43.9–45.4 | 1/2 bins | station.oct |
| 1600–1750 | open | scholars | 40–42.5 | — |  |
| 1750–2500 | coastal | scholars, flats | 22.7–38.4 | 2/15 bins | station.jul |
| 2500–2550 | coastal cliff | flats | 16.8–16.8 | 1/1 bins |  |
| 2550–2850 | bridge | bight | 11.7–12 | 6/6 bins |  |
| 2850–2950 | coastal | bight | 9–9.7 | 2/2 bins |  |
| 2950–3200 | open | bight, landing | 4.7–9 | 1/5 bins |  |
| 3200–3250 | bridge | landing | 5.5–5.5 | — |  |
| 3250–3300 | developed | landing | 4.2–4.2 | — | tidelinePark |
| 3300–3500 | coastal | landing, reach | 2.9–4.7 | — | place.campfire |
| 3500–3650 | bridge | reach | 7.4–9 | — | homestead.landing |
| 3650–3889.8 | open | reach, harbour | 9.4–22.8 | — |  |

Rule: bridge/gallery from the deck under the centreline; *coastal cliff* = sea (terrain ≤ 0.3) within 40 m of the centreline and more than 15 m of drop within 40 m; *coastal* = sea within 80 m; *developed* = a station, town, host, homestead or place pad within 45 m; else *open*.

## V01 station chart (50 m bins)

| Station m | Section | District | Elev m | Sea | Max drop ≤40 m | Year Walk alongside | Min width m | Pads within 45 m |
|---|---|---|---:|---|---:|---|---:|---|
| 0–50 | junction | harbour | 22.1 | — | 10.7 | — | 10.75 |  |
| 50–100 | junction | harbour | 18.5 | — | 6.8 | — | 12.5 | town.upperStreet |
| 100–150 | junction | harbour | 15.3 | — | 3.3 | 6 m (Δh -0.7) | 5.5 |  |
| 150–200 | junction | harbour | 19.8 | — | 0.4 | 6.9 m (Δh 0) | 15.5 | plot.terraces.3.layby |
| 200–250 | gallery/tunnel, junction | prow | 23.3 | — | 2 | 6.5 m (Δh 0) | 15.5 | plot.terraces.2.layby, plot.terraces.3.layby |
| 250–300 | gallery/tunnel, junction | prow | 27.1 | — | 1.9 | 6.7 m (Δh -0.1) | 15.75 | station.nov, plot.terraces.2.layby |
| 300–350 | gallery/tunnel, junction | prow | 30.8 | — | 0.3 | 5.6 m (Δh 0.1) | 3.25 | plot.terraces.1.apron, plot.terraces.1.layby |
| 350–400 | junction | prow | 34.5 | — | 2.3 | 6.9 m (Δh -0.1) | 9.75 | plot.terraces.1.layby |
| 400–450 | open road | prow | 38.3 | — | 8.1 | 6.5 m (Δh 0) | 15.75 |  |
| 450–500 | junction | prow | 42.1 | — | 5.8 | 8.9 m (Δh -0.4) | 12 |  |
| 500–550 | junction | prow | 45.9 | — | 2 | 8.9 m (Δh -0.1) | 10.5 |  |
| 550–600 | open road | prow | 49.4 | 70 m right | 0.3 | 8.4 m (Δh 0) | 15 |  |
| 600–650 | open road | prow | 53.2 | 50 m right | 0.7 | 8.7 m (Δh -0.2) | 16 |  |
| 650–700 | open road | crown | 56.9 | 34 m right | 58.6 | 9.3 m (Δh 0) | 13.75 |  |
| 700–750 | open road | crown | 60.2 | 34 m right | 62.8 | 9.5 m (Δh 0.2) | 12 |  |
| 750–800 | open road | crown | 63.9 | 30 m right | 66.8 | 9.5 m (Δh 0) | 13.5 |  |
| 800–850 | open road | crown | 67.8 | 30 m right | 70.4 | 9 m (Δh -0.2) | 12.25 |  |
| 850–900 | open road | crown | 70.2 | 22 m right | 74.1 | 10.5 m (Δh -0.1) | 14.25 |  |
| 900–950 | open road | crown | 72.3 | 22 m right | 75.8 | 11.4 m (Δh 0) | 14.5 |  |
| 950–1000 | open road | crown | 74.5 | 34 m right | 75.1 | 6.9 m (Δh 0) | 13.75 |  |
| 1000–1050 | junction | crown | 73.1 | 34 m right | 75.2 | 7 m (Δh 0.2) | 14 |  |
| 1050–1100 | open road | crown | 70.3 | 42 m right | 70.9 | 7.9 m (Δh -0.1) | 14.75 |  |
| 1100–1150 | open road | crown | 67.2 | 54 m right | 30.7 | 8.1 m (Δh 0) | 12.75 |  |
| 1150–1200 | open road | crown | 64.2 | 66 m right | 28.4 | 7.3 m (Δh 0.1) | 12.75 |  |
| 1200–1250 | open road | crown | 61.2 | 70 m right | 26.1 | 6.2 m (Δh 0) | 12.75 |  |
| 1250–1300 | open road | crown | 58.2 | — | 24.2 | 6.6 m (Δh -0.2) | 12.75 |  |
| 1300–1350 | open road | scholars | 55.2 | — | 22 | 6.5 m (Δh 0.1) | 12.75 |  |
| 1350–1400 | open road | scholars | 52.2 | — | 21.1 | 6.5 m (Δh 0.1) | 12.75 |  |
| 1400–1450 | junction | scholars | 49.2 | — | 12.5 | 6.4 m (Δh -0.1) | 14.75 |  |
| 1450–1500 | junction | scholars | 47 | — | 2.6 | 18 m (Δh -0.7) | 13.25 |  |
| 1500–1550 | junction | scholars | 45.4 | — | 3.5 | 9.3 m (Δh -0.3) | 10.5 | station.oct |
| 1550–1600 | open road | scholars | 43.9 | — | 4.4 | — | 16 | station.oct |
| 1600–1650 | open road | scholars | 42.5 | — | 4.5 | — | 16 |  |
| 1650–1700 | junction | scholars | 41.4 | — | 3.8 | — | 10.5 |  |
| 1700–1750 | open road | scholars | 40 | — | 5.2 | — | 16 |  |
| 1750–1800 | open road | scholars | 37.7 | 78 m right | 5.6 | — | 14.75 |  |
| 1800–1850 | open road | scholars | 37.5 | 70 m right | 2.8 | — | 16 |  |
| 1850–1900 | open road | scholars | 38.4 | 62 m right | 1.1 | — | 16 |  |
| 1900–1950 | open road | flats | 37.2 | 58 m right | 1.5 | — | 16 |  |
| 1950–2000 | open road | flats | 35.8 | 54 m right | 1.5 | — | 16 |  |
| 2000–2050 | open road | flats | 34.8 | 54 m right | 1.6 | — | 16 |  |
| 2050–2100 | open road | flats | 34.3 | 62 m right | 1.6 | — | 16 |  |
| 2100–2150 | open road | flats | 34.1 | 62 m right | 1.5 | — | 16 |  |
| 2150–2200 | open road | flats | 33.9 | 62 m right | 1.5 | — | 16 |  |
| 2200–2250 | open road | flats | 32.7 | 66 m right | 1.2 | — | 16 |  |
| 2250–2300 | open road | flats | 30 | 70 m right | 0.2 | — | 16 | station.jul |
| 2300–2350 | open road | flats | 27 | 66 m right | 0.3 | — | 15 |  |
| 2350–2400 | open road | flats | 24.6 | 58 m right | 0.3 | — | 14.5 |  |
| 2400–2450 | junction | flats | 28.3 | 50 m right | 6.7 | 13.5 m (Δh -7.7) | 9.5 |  |
| 2450–2500 | open road | flats | 22.7 | 42 m right | 18.9 | 5.2 m (Δh -4.9) | 9.5 |  |
| 2500–2550 | open road | flats | 16.8 | 22 m right | 20.1 | 5.7 m (Δh -1.8) | 8.25 |  |
| 2550–2600 | bridge | bight | 12 | 6 m left | 21.2 | 6.3 m (Δh 0.2) | 9.5 |  |
| 2600–2650 | bridge | bight | 12 | 6 m left | 24 | 5.2 m (Δh 0) | 11.75 |  |
| 2650–2700 | bridge | bight | 12 | 6 m left | 24 | 5.5 m (Δh 0) | 11.75 |  |
| 2700–2750 | bridge | bight | 12 | 6 m left | 24 | 5.4 m (Δh 0) | 12.75 |  |
| 2750–2800 | bridge | bight | 12 | 6 m left | 24 | 5.3 m (Δh 0) | 11.25 |  |
| 2800–2850 | bridge | bight | 11.7 | 6 m left | 18.6 | 4.9 m (Δh -0.1) | 13 |  |
| 2850–2900 | open road | bight | 9.7 | 34 m right | 10.8 | 8.7 m (Δh 0.2) | 12.75 |  |
| 2900–2950 | junction | bight | 9 | 62 m right | 2.9 | 17.1 m (Δh -0.2) | 12.75 |  |
| 2950–3000 | junction | bight | 9 | — | 0.3 | — | 16 |  |
| 3000–3050 | open road | landing | 8.9 | — | 2.2 | — | 16 |  |
| 3050–3100 | open road | landing | 8.1 | — | 3.6 | — | 14.75 |  |
| 3100–3150 | open road | landing | 6 | — | 3.5 | — | 14.5 |  |
| 3150–3200 | junction | landing | 4.7 | — | 2.6 | 4.6 m (Δh -0.5) | 9.25 |  |
| 3200–3250 | bridge | landing | 5.5 | — | 4.2 | — | 9.5 |  |
| 3250–3300 | open road | landing | 4.2 | — | 4 | — | 10 | tidelinePark |
| 3300–3350 | open road | landing | 3 | 74 m right | 1.3 | — | 16 |  |
| 3350–3400 | open road | landing | 2.9 | 70 m right | 0.5 | — | 16 |  |
| 3400–3450 | open road | landing | 3.2 | 58 m right | 1.6 | — | 16 | place.campfire |
| 3450–3500 | open road | reach | 4.7 | 46 m right | 4.9 | — | 14.75 |  |
| 3500–3550 | bridge, junction | reach | 7.4 | 30 m right | 8.2 | — | 9.5 |  |
| 3550–3600 | bridge, junction | reach | 9 | 18 m right | 8.8 | — | 7.5 | homestead.landing |
| 3600–3650 | bridge, junction | reach | 9 | 38 m left | 8.7 | — | 9.5 | homestead.landing |
| 3650–3700 | junction | reach | 9.4 | — | 7.2 | — | 10 |  |
| 3700–3750 | open road | reach | 12.5 | — | 8.6 | — | 13.75 |  |
| 3750–3800 | open road | harbour | 16 | — | 9.9 | — | 10.25 |  |
| 3800–3850 | junction | harbour | 19.7 | — | 8.1 | — | 11 |  |
| 3850–3889.8 | open road | harbour | 22.8 | — | 10.4 | — | 13.25 |  |

## V01 — 8 m bed, 3889.8 m (closed loop)

Drives: **fwd/centre** 3900 m in 252 s sim (mean 15.44 m/s, max 16), 260 contact steps, 0 airborne steps, restarts: stall plot.terraces.1.layby.slab@prow @330.5 · **fwd/right+2** 3900 m in 259.9 s sim (mean 14.92 m/s, max 16), 985 contact steps, 0 airborne steps, restarts: stall yearWalk.bed.prow@prow @503; stall bightBridge.s2Ramp.sea.posts@bight @2716; stall bightBridge.s2Ramp.sea.posts@bight @2726.5; stall low-headroom @3592 · **rev/centre** 3900 m in 249.2 s sim (mean 15.64 m/s, max 16), 0 contact steps, 50 airborne steps · **rev/right+2** 3900 m in 248.7 s sim (mean 15.63 m/s, max 16), 0 contact steps, 48 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | pad-lip | 64 | [1463.7, 18.2, 1050.5] | -0.973 m step | static | pad town.upperStreet (place, top 18 vs road bed 19.13): 1 lips between the road and 4 m inside the pad; worst 5.1 m out from the road centre: step down 0.97 m V01.shoulders.harbour@harbour → terrain |
| BLOCKER | headroom | 108–132 | [1521.3, 15.8, 1021.1] | 0.24 m clear | static | 0.24 m headroom under yearWalk.bed.harbour@harbour at 3.49 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| BLOCKER | buried | 124–134 | [1523.2, 16.3, 1024.1] | 0.565 m terrain above deck | static | visible terrain 0.565 m above the deck inside the carriageway over 12 m |
| BLOCKER | lip | 131.8 | [1526.2, 17.4, 1021.6] | 0.835 m step | static | step up 0.83 m terrain → yearWalk.bed.harbour@harbour on lines 3 m |
| BLOCKER | transition | 324.5 | [1601.5, 31.9, 839.9] | 0.613 m step | static | prowTunnel end: structure bed 30.82 vs road bed 30.87 (Δ -0.05 m, plan offset 0.02 m); 7 lips > 0.08 m within ±15 m, worst on line 0 m at 6.3 m: step up 0.61 m V01.bed.prow@prow → plot.terraces.1.layby.slab@prow |
| BLOCKER | stall | 330.5 | [1601.1, 31.3, 840.3] | —  | fwd/centre | stalled against plot.terraces.1.layby.slab@prow (pad/floor) |
| BLOCKER | lip | 330.8–332 | [1601.5, 31.9, 839.9] | 0.613 m step | static | step up 0.61 m V01.bed.prow@prow → plot.terraces.1.layby.slab@prow on lines 0, -1.5, -3 m |
| BLOCKER | airborne | 331–325 | [1601.5, 31.9, 839.9] | 1.09 m drop | rev/centre, rev/right+2 (2×) | launched 0.42 s at 15.9 m/s, 1.09 m drop, landing 5.0 m/s: deck/structure seam plot.terraces.1.layby.slab@prow → V01.bed.prow@prow |
| BLOCKER | lip | 376.1–376.2 | [1596.8, 35.2, 794.7] | 0.542 m step | static | step up 0.54 m V01.bed.prow@prow → V03.bed.prow@prow on lines -1.5, -3 m |
| BLOCKER | junction-lip | 380 | [1596.8, 35.2, 794.7] | 0.542 m step | static | junction cross.v01.v03.1 (V01 × V03): 1 lips > 0.08 m; worst on road-3 at -3.8 m: step up 0.54 m V01.bed.prow@prow → V03.bed.prow@prow |
| BLOCKER | lip | 502.3–503.9 | [1588.8, 45.5, 667.2] | 0.509 m step | static | step up 0.51 m V01.bed.prow@prow → yearWalk.bed.prow@prow on lines -3, -1.5, 0, 1.5, 3 m |
| BLOCKER | stall | 503 | [1588.2, 45, 668] | —  | fwd/right+2 | stalled against yearWalk.bed.prow@prow (bed/deck) |
| BLOCKER | junction-lip | 506 | [1588.8, 45.5, 667.2] | 0.509 m step | static (5×) | junction cross.v01.yearWalk.2 (V01 × yearWalk): 5 lips > 0.08 m; worst on road+3 at -2.1 m: step up 0.51 m V01.bed.prow@prow → yearWalk.bed.prow@prow |
| BLOCKER | headroom | 2704–2766 | [616.5, 12, 1141.3] | 0.2 m clear | static | 0.2 m headroom under bightBridge.s2Ramp.sea.deck@bight at 3.83 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| BLOCKER | stall | 2716 | [573.4, 12, 1116.2] | —  | fwd/right+2 | stalled against bightBridge.s2Ramp.sea.posts@bight (post/support) |
| BLOCKER | stall | 2726.5 | [582, 12, 1121.7] | —  | fwd/right+2 | stalled against bightBridge.s2Ramp.sea.posts@bight (post/support) |
| BLOCKER | junction-lip | 3180 | [948.8, 3.9, 1379.3] | -0.717 m step | static (3×) | junction cross.v01.yearWalk.6 (V01 × yearWalk): 3 lips > 0.08 m; worst on other+ at 5.09 m: step down 0.72 m V01.bed.green@landing → yearWalk.bed.landing@landing |
| BLOCKER | pad-lip | 3255 | [1003.4, 3.1, 1392] | -2.552 m step | static (7×) | pad tidelinePark (place, top 3 vs road bed 5.12): 7 lips between the road and 4 m inside the pad; worst 5.1 m out from the road centre: step down 2.55 m V01.shoulders.landing@landing → terrain |
| BLOCKER | headroom | 3550–3552 | [1318.6, 9, 1374] | 0.92 m clear | static | 0.92 m headroom under S3.edges.reach@reach at 2.76 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| BLOCKER | headroom | 3592–3594 | [1349.2, 9, 1346.3] | 0.96 m clear | static | 0.96 m headroom under crossing.cross.s3.riverLower.1.rails@reach at 1.74 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| BLOCKER | stall | 3592 | [1351.1, 9, 1347.2] | —  | fwd/right+2 | stalled against low-headroom (low-headroom/sim) |
| MAJOR | seam | 62 | [1461.2, 18.5, 1048.9] | -0.747 m step | static | crack 0.75 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| terrain showing) on lines 3 m |
| MAJOR | seam | 70 | [1468.5, 18, 1045.4] | -0.65 m step | static | crack 0.65 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| town.upperStreet.slab@harbour showing) on lines 1.5, 3 m |
| MAJOR | lip | 84.1–84.7 | [1482.6, 17.8, 1040.6] | -0.173 m step | static | step down 0.17 m spur upperStreet.bed.harbour@harbour → V01.bed.harbour@harbour on lines 3, 1.5 m |
| MAJOR | grade | 94–118 | [1498.1, 16.5, 1032.7] | 12 % max | static | 24 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum |
| MAJOR | obstruction | 104–106 | [1499.9, 16.3, 1032] | 3.75 m from centre | static | bed/deck yearWalk.bed.harbour@harbour inside the carriageway at 3.75 m from centre |
| MAJOR | obstruction | 104–114 | [1499.9, 16.3, 1032] | 3.25 m from centre | static | bed/deck yearWalk.bed.harbour@harbour inside the carriageway at 3.25 m from centre |
| MAJOR | seam | 112.8 | [1509.2, 14.5, 1031] | -0.769 m step | static | crack 0.77 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| terrain showing) on lines 3 m |
| MAJOR | junction-lip | 118 | [1509.2, 14.5, 1031] | -0.769 m step | static (5×) | junction cross.v01.yearWalk.1 (V01 × yearWalk): 5 lips > 0.08 m; worst on road+3 at -5.2 m: crack 0.77 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| terrain showing) |
| MAJOR | obstruction | 126–128 | [1521.3, 15.8, 1021.1] | 3.5 m from centre | static | bed/deck yearWalk.bed.harbour@harbour inside the carriageway at 3.5 m from centre |
| MAJOR | obstruction | 132–144 | [1532.7, 17.2, 1013] | 1.75 m from centre | static | bed/deck yearWalk.bed.prow@harbour inside the carriageway at 1.75 m from centre |
| MAJOR | narrow | 134–144 | [1532.7, 17.2, 1013] | 5.5 m usable | static | usable width 5.5 m (< 7): left blocker yearWalk.bed.notch@harbour at 3.75 m, right blocker yearWalk.bed.prow@harbour at 1.75 m |
| MAJOR | contact | 135.5–137.5 | [1529.2, 16.6, 1018.2] | 0.11 s | fwd/right+2 (3×) | in-lane contact with yearWalk.bed.harbour@harbour (bed/deck) for 0.11 s, 15.5→15.6 m/s |
| MAJOR | contact | 137.5–144.5 | [1530.5, 16.8, 1017] | 0.18 s | fwd/right+2 (3×) | in-lane contact with yearWalk.bed.prow@harbour (bed/deck) for 0.17 s, 15.8→15.8 m/s |
| MAJOR | obstruction | 138–142 | [1529.6, 16.8, 1015.5] | 3.75 m from centre | static | bed/deck yearWalk.bed.notch@harbour inside the carriageway at 3.75 m from centre |
| MAJOR | lip | 183.6–185.7 | [1553.4, 20.7, 976.5] | 0.286 m step | static | step up 0.29 m V01.bed.prow@prow → plot.terraces.3.service.bed.prow@prow on lines 3, -3, -1.5, 0, 1.5 m |
| MAJOR | drive-lip | 185 | [1554.4, 20.4, 976.5] | -0.255 m | rev/right+2 | step down 0.25 m between plot.terraces.3.service.bed.prow@prow and V01.bed.prow@prow |
| MAJOR | drive-lip | 185.5 | [1556.5, 20.7, 977] | 0.233 m | fwd/centre, fwd/right+2 (2×) | step up 0.23 m between V01.bed.prow@prow and plot.terraces.3.layby.slab@prow |
| MAJOR | drive-lip | 185.5 | [1556.4, 20.5, 977] | -0.228 m | rev/centre | step down 0.23 m between plot.terraces.3.layby.slab@prow and V01.bed.prow@prow |
| MAJOR | junction-lip | 189 | [1553.4, 20.7, 976.5] | 0.286 m step | static (4×) | junction cross.v01.plotTerraces3Service.1 (V01 × plot.terraces.3.service): 4 lips > 0.08 m; worst on road-3 at -4.4 m: step up 0.29 m V01.bed.prow@prow → plot.terraces.3.service.bed.prow@prow |
| MAJOR | lip | 201.6–202.5 | [1566, 21.6, 963.7] | -0.208 m step | static | step down 0.21 m yearWalk.shoulders.prow@prow → V01.bed.prow@prow on lines 3 m |
| MAJOR | transition | 234.5 | [1583.9, 25.3, 921.6] | 0.267 m step | static | prowTunnel start: structure bed 24.11 vs road bed 24.1 (Δ 0.01 m, plan offset 0.02 m); 5 lips > 0.08 m within ±15 m, worst on line 3 m at 12.6 m: step up 0.27 m prowTunnel.floor@prow → plot.terraces.2.layby.slab@prow |
| MAJOR | drive-lip | 247 | [1583, 25.3, 921.1] | 0.258 m | fwd/centre, fwd/right+2 (2×) | step up 0.26 m between prowTunnel.floor@prow and plot.terraces.2.layby.slab@prow |
| MAJOR | drive-lip | 247–247.5 | [1581.1, 25.1, 920.5] | -0.258 m | rev/centre, rev/right+2 (2×) | step down 0.26 m between plot.terraces.2.layby.slab@prow and prowTunnel.floor@prow |
| MAJOR | lip | 247.1–247.3 | [1583.9, 25.3, 921.6] | 0.267 m step | static | step up 0.27 m prowTunnel.floor@prow → plot.terraces.2.layby.slab@prow on lines 3, 0, 1.5, -3, -1.5 m |
| MAJOR | junction-lip | 250.5 | [1583.9, 25.3, 921.6] | 0.267 m step | static (3×) | junction cross.v01.plotTerraces2Service.2 (V01 × plot.terraces.2.service): 3 lips > 0.08 m; worst on road+3 at -3.4 m: step up 0.27 m prowTunnel.floor@prow → plot.terraces.2.layby.slab@prow |
| MAJOR | grade | 322–338 | [1601.1, 30.7, 848.7] | 12.44 % max | static | 16 m over 8 % (max 12.4 % per 10 m) — over the 12 % profile maximum |
| MAJOR | contact | 330–330.5 | [1601.3, 31.3, 840.4] | 0.07 s | fwd/centre (3×) | in-lane contact with plot.terraces.1.layby.slab@prow (pad/floor) for 0.07 s, 4.2→1.3 m/s |
| MAJOR | surface-mismatch | 331–335 | [1601.5, 31.9, 839.6] | 0.6 m vs bed | fwd/right+2, rev/centre, rev/right+2 (3×) | rode above the bed line by 0.60 m on plot.terraces.1.layby.slab@prow |
| MAJOR | narrow | 332 | [1601.5, 31.4, 838.7] | 3.25 m usable | static | usable width 3.25 m (< 7): left blocker plot.terraces.1.layby.slab@prow at 2.75 m, right blocker plot.terraces.1.layby.slab@prow at 0.5 m |
| MAJOR | obstruction | 332 | [1601.5, 31.4, 838.7] | 2.75 m from centre | static | pad/floor plot.terraces.1.layby.slab@prow inside the carriageway at 2.75 m from centre |
| MAJOR | obstruction | 332 | [1601.5, 31.4, 838.7] | 0.5 m from centre | static | pad/floor plot.terraces.1.layby.slab@prow inside the carriageway at 0.5 m from centre |
| MAJOR | lip | 334.1 | [1603, 31.9, 836.6] | 0.388 m step | static | step up 0.39 m V01.bed.prow@prow → plot.terraces.1.layby.slab@prow on lines 1.5 m |
| MAJOR | drive-lip | 335 | [1603.5, 31.9, 835.4] | 0.311 m | fwd/right+2 | step up 0.31 m between V01.bed.prow@prow and plot.terraces.1.layby.slab@prow |
| MAJOR | pad-lip | 339.5 | [1602.8, 31.5, 837.2] | -0.427 m step | static | pad plot.terraces.1.layby (landing, top 31.93 vs road bed 31.94): 1 lips between the road and 4 m inside the pad; worst 1.3 m out from the road centre: step down 0.43 m plot.terraces.1.layby.slab@prow → V01.bed.prow@prow |
| MAJOR | lip | 362.7 | [1597.7, 33.8, 808.2] | 0.168 m step | static | step up 0.17 m V01.bed.prow@prow → yearWalk.shoulders.prow@prow on lines -3 m |
| MAJOR | obstruction | 376 | [1599.8, 34.7, 794.7] | 1.75 m from centre | static | bed/deck V03.bed.prow@prow inside the carriageway at 1.75 m from centre |
| MAJOR | drive-lip | 376 | [1597.8, 34.7, 794.8] | -0.452 m | rev/right+2 | step down 0.45 m between V03.bed.prow@prow and V01.bed.prow@prow |
| MAJOR | buried | 456–460 | [1588, 41.2, 713.5] | 0.373 m terrain above deck | static | visible terrain 0.373 m above the deck inside the carriageway over 6 m |
| MAJOR | drive-lip | 502.5–503 | [1586, 44.9, 668.5] | -0.278 m | rev/centre, rev/right+2 (2×) | step down 0.28 m between yearWalk.bed.prow@prow and V01.bed.prow@prow |
| MAJOR | drive-lip | 503 | [1586, 45.2, 668.3] | 0.275 m | fwd/centre | step up 0.27 m between V01.bed.prow@prow and yearWalk.bed.prow@prow |
| MAJOR | contact | 503 | [1588, 44.9, 668] | 0.22 s | fwd/right+2 (2×) | in-lane contact with yearWalk.bed.prow@prow (bed/deck) for 0.22 s, 4.3→0.2 m/s |
| MAJOR | lip | 510.1–510.4 | [1587.9, 45.3, 660.7] | -0.325 m step | static | step down 0.33 m yearWalk.shoulders.prow@prow → V01.bed.prow@prow on lines 1.5, 3 m |
| MAJOR | seam | 689.9–690 | [1558.6, 57.5, 483] | -0.292 m step | static | crack 0.29 m deep, 0.4 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 3, 1.5 m |
| MAJOR | seam | 694.3–694.4 | [1556.4, 57.8, 478.6] | -0.217 m step | static | crack 0.22 m deep, 0.6 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 3, 1.5 m |
| MAJOR | drive-lip | 694.5–698 | [1555.2, 57.8, 478.9] | -0.154 m | fwd/right+2 (4×) | step down 0.15 m between terrain and terrain |
| MAJOR | seam | 697.4–697.5 | [1553, 58, 476.6] | -0.174 m step | static | crack 0.17 m deep, 0.4 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 3, 1.5 m |
| MAJOR | seam | 702.5–702.6 | [1546, 58.3, 476.6] | -0.335 m step | static | crack 0.33 m deep, 0.5 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 929.3–929.4 | [1398.6, 72.4, 303.9] | -0.177 m step | static | crack 0.18 m deep, 0.5 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3, 1.5 m |
| MAJOR | seam | 933.2 | [1394.7, 72.5, 302.3] | -0.241 m step | static | crack 0.24 m deep, 0.4 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5, 3 m |
| MAJOR | junction-lip | 1010.5 | [1322.9, 74, 273.7] | 0.31 m step | static (3×) | junction cross.v01.yearWalk.3 (V01 × yearWalk): 3 lips > 0.08 m; worst on road-3 at 1.9 m: step up 0.31 m V01.bed.crown@crown → yearWalk.shoulders.crown@crown |
| MAJOR | lip | 1010.6 | [1324.3, 73.8, 274.8] | -0.24 m step | static | step down 0.24 m yearWalk.bed.crown@crown → V01.bed.crown@crown on lines -3 m |
| MAJOR | lip | 1012.4–1013 | [1322.9, 74, 273.7] | 0.31 m step | static | step up 0.31 m V01.bed.crown@crown → yearWalk.shoulders.crown@crown on lines -3 m |
| MAJOR | drive-lip | 1015 | [1321.7, 73.8, 271.5] | 0.219 m | rev/right+2 | step up 0.22 m between V01.bed.crown@crown and yearWalk.shoulders.crown@crown |
| MAJOR | lip | 1015.5 | [1321.3, 73.5, 270.8] | -0.227 m step | static | step down 0.23 m yearWalk.shoulders.crown@crown → V01.bed.crown@crown on lines -1.5 m |
| MAJOR | lip | 1017.8 | [1320.2, 73.4, 268.3] | -0.246 m step | static | step down 0.25 m yearWalk.shoulders.crown@crown → V01.bed.crown@crown on lines 0 m |
| MAJOR | drive-lip | 1018–1021 | [1320.2, 73.4, 268.2] | -0.245 m | fwd/centre, fwd/right+2 (2×) | step down 0.24 m between yearWalk.shoulders.crown@crown and V01.bed.crown@crown |
| MAJOR | drive-lip | 1018–1021.5 | [1320.3, 73.6, 268.2] | 0.244 m | fwd/right+2, rev/centre (2×) | step up 0.24 m between V01.bed.crown@crown and yearWalk.shoulders.crown@crown |
| MAJOR | lip | 1020.2 | [1318.9, 73.3, 265.7] | -0.232 m step | static | step down 0.23 m yearWalk.shoulders.crown@crown → V01.bed.crown@crown on lines 1.5 m |
| MAJOR | drive-lip | 1021.5 | [1317.9, 73.2, 264.5] | 0.236 m | fwd/right+2 | step up 0.24 m between terrain and V01.bed.crown@crown |
| MAJOR | missing-guard | 1248 | [1092.5, 59.8, 253.5] | 1.66 m drop | static | left edge: 1.66 m drop at 6.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | missing-guard | 1328 | [1013.9, 55, 268.3] | 1.75 m drop | static | left edge: 1.75 m drop at 6.5 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | missing-guard | 1344 | [998.2, 54, 271.5] | 1.29 m drop | static | left edge: 1.29 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | junction-lip | 1444 | [896.3, 47.9, 293.5] | -0.157 m step | static (2×) | junction cross.v01.spurLibrary.1 (V01 × spur library): 2 lips > 0.08 m; worst on road-3 at 4 m: step down 0.16 m VG.shoulders.scholars@scholars → V01.bed.scholars@scholars |
| MAJOR | junction-lip | 1444 | [896.3, 47.9, 293.5] | -0.157 m step | static (2×) | junction cross.v01.vG.1 (V01 × VG): 2 lips > 0.08 m; worst on road-3 at 4 m: step down 0.16 m VG.shoulders.scholars@scholars → V01.bed.scholars@scholars |
| MAJOR | lip | 1448 | [896.3, 47.9, 293.5] | -0.157 m step | static | step down 0.16 m VG.shoulders.scholars@scholars → V01.bed.scholars@scholars on lines -3 m |
| MAJOR | lip | 1458.7 | [885.6, 47.5, 294.4] | -0.174 m step | static | step down 0.17 m spur library.bed.scholars@scholars → V01.bed.scholars@scholars on lines -3 m |
| MAJOR | junction-lip | 1533.5 | [807, 45, 297.1] | -0.19 m step | static (4×) | junction cross.v01.yearWalk.4 (V01 × yearWalk): 4 lips > 0.08 m; worst on road-3 at 3.7 m: step down 0.19 m yearWalk.shoulders.scholars@scholars → V01.bed.scholars@scholars |
| MAJOR | drive-lip | 1537 | [807.2, 45.2, 296.1] | 0.17 m | rev/centre, rev/right+2 (2×) | step up 0.17 m between V01.bed.scholars@scholars and yearWalk.shoulders.scholars@scholars |
| MAJOR | lip | 1537.1–1537.3 | [807, 45, 297.1] | -0.19 m step | static | step down 0.19 m yearWalk.shoulders.scholars@scholars → V01.bed.scholars@scholars on lines -1.5, -3, 0, 1.5, 3 m |
| MAJOR | missing-guard | 2418–2420 | [400.8, 27.9, 889.3] | 3.12 m drop | static | right edge: 3.12 m drop at 5.25 m from centre with no guard (onto terrain) over 4 m |
| MAJOR | floating-edge | 2422 | [401.3, 28.1, 891.2] | 3.31 m gap | static | right deck edge hangs 3.31 m over the terrain with no retaining wall or parapet, over 2 m |
| MAJOR | missing-guard | 2424 | [401.9, 28.3, 893.1] | 4.82 m drop | static | right edge: 4.82 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | grade | 2424–2574 | [408.2, 26.1, 914.2] | 12 % max | static | 150 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum |
| MAJOR | missing-guard | 2426 | [402.5, 28.4, 895.1] | 6.59 m drop | static | left edge: 6.59 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | floating-edge | 2428–2430 | [403, 28.2, 897] | 5.3 m gap | static | left deck edge hangs 5.3 m over the terrain with no retaining wall or parapet, over 4 m |
| MAJOR | missing-guard | 2430 | [403.6, 28, 898.9] | 5.96 m drop | static | left edge: 5.96 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | floating-edge | 2434–2540 | [405.3, 27.3, 904.7] | 6.4 m gap | static | left deck edge hangs 6.4 m over the terrain with no retaining wall or parapet, over 108 m |
| MAJOR | seam | 2484.4 | [417.6, 20.6, 951.6] | -0.903 m step | static | crack 0.90 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MAJOR | missing-guard | 2506–2530 | [428.1, 18.9, 970.8] | 2.94 m drop | static | left edge: 2.94 m drop at 4.25 m from centre with no guard (onto yearWalk.bed.flats@flats) over 26 m |
| MAJOR | missing-guard | 2546 | [444.9, 14.3, 1007.1] | 1.71 m drop | static | right edge: 1.71 m drop at 6 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | seam | 2557.1 | [447.9, 11.4, 1018.3] | -1.991 m step | static | crack 1.99 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines 3 m |
| MAJOR | seam | 2561.5 | [450.3, 11.7, 1022.1] | -1.319 m step | static | crack 1.32 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines 3 m |
| MAJOR | seam | 2565.6 | [452.7, 11.4, 1025.5] | -1.317 m step | static | crack 1.32 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines 3 m |
| MAJOR | missing-guard | 2566 | [455.4, 12.6, 1024.1] | 1.29 m drop | static | right edge: 1.29 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | seam | 2569.6–2570.6 | [455.2, 11.3, 1028.8] | -0.989 m step | static | crack 0.99 m deep, 0.3 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines 3, -3 m |
| MAJOR | transition | 2572.5 | [457.7, 10.1, 1031.9] | -1.932 m step | static | structure.bightBridge start: structure bed 12 vs road bed 12.09 (Δ -0.09 m, plan offset 1.61 m); 6 lips > 0.08 m within ±15 m, worst on line 3 m at 1 m: crack 1.93 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) |
| MAJOR | seam | 2573.3–2573.5 | [457.7, 10.1, 1031.9] | -1.932 m step | static | crack 1.93 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines -3, 3 m |
| MAJOR | frame-mismatch | 2573.5–2818.5 | — | 7.16 m lateral | static | V01 spline vs the Bight Bridge straight frame: up to 7.16 m lateral at station 2643.5 (deck half-width 10.8, V01 edge 5) |
| MAJOR | obstruction | 2628–2630 | [501.4, 12, 1065.3] | 3.75 m from centre | static | deckParapet/rail bightBridge.rails@bight inside the carriageway at 3.75 m from centre |
| MAJOR | obstruction | 2662–2666 | [529.2, 12, 1084.8] | 3.75 m from centre | static | deckParapet/rail bightBridge.rails@bight inside the carriageway at 3.75 m from centre |
| MAJOR | contact | 2716 | [573.3, 12, 1116.2] | 0.01 s | fwd/right+2 (2×) | in-lane contact with bightBridge.s2Ramp.sea.posts@bight (post/support) for 0.01 s, 16→0.6 m/s |
| MAJOR | contact | 2726.5 | [582, 12, 1121.7] | 0.04 s | fwd/right+2 (50×) | in-lane contact with bightBridge.s2Ramp.sea.posts@bight (post/support) for 0.04 s, 0.1→0 m/s |
| MAJOR | obstruction | 2754–2768 | [606.4, 12, 1134.9] | 3.25 m from centre | static | skateRamp/deck bightBridge.s2Ramp.sea.deck@bight inside the carriageway at 3.25 m from centre |
| MAJOR | junction-lip | 2941.5 | [752.3, 8.8, 1250.3] | -0.174 m step | static (2×) | junction cross.v01.yearWalk.5 (V01 × yearWalk): 2 lips > 0.08 m; worst on other- at 5.21 m: step down 0.17 m V01.shoulders.bight@bight → yearWalk.bed.bight@bight |
| MAJOR | obstruction | 3186 | [958.7, 4.7, 1377.5] | 2.5 m from centre | static | bed/deck yearWalk.bed.green@landing inside the carriageway at 2.5 m from centre |
| MAJOR | drive-lip | 3186 | [959.2, 5, 1375.6] | 0.302 m | rev/right+2 | step up 0.30 m between V01.bed.green@landing and yearWalk.shoulders.green@landing |
| MAJOR | lip | 3186.4–3186.5 | [959.8, 4.7, 1374.7] | -0.41 m step | static | step down 0.41 m yearWalk.bed.green@landing → V01.bed.green@landing on lines -3, -1.5 m |
| MAJOR | buried | 3198–3202 | [973.1, 5.2, 1377.2] | 0.39 m terrain above deck | static | visible terrain 0.39 m above the deck inside the carriageway over 6 m |
| MAJOR | floating-edge | 3228–3232 | [1003.8, 5.6, 1386.9] | 1.85 m gap | static | right deck edge hangs 1.85 m over the terrain with no retaining wall or parapet, over 6 m |
| MAJOR | missing-guard | 3234–3236 | [1007.7, 5.6, 1387.6] | 1.34 m drop | static | left edge: 1.34 m drop at 5.25 m from centre with no guard (onto terrain, on duneCulvert.roof@landing) over 4 m |
| MAJOR | floating-edge | 3242–3250 | [1019.5, 5.5, 1389.7] | 1.58 m gap | static | left deck edge hangs 1.58 m over the terrain with no retaining wall or parapet, over 10 m |
| MAJOR | floating-edge | 3242–3250 | [1013.6, 5.6, 1388.7] | 3.51 m gap | static | right deck edge hangs 3.51 m over the terrain with no retaining wall or parapet, over 10 m |
| MAJOR | missing-guard | 3250 | [1021.5, 5.4, 1390.1] | 1.28 m drop | static | left edge: 1.28 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | drive-lip | 3522.5–3530.5 | [1297.7, 7.9, 1380.5] | 0.172 m | fwd/centre, fwd/right+2, rev/centre (4×) | step up 0.17 m between V01.bed.landing@reach and spur boathouse.bed.reach@reach |
| MAJOR | lip | 3528–3528.2 | [1297.6, 7.9, 1380.5] | 0.18 m step | static | step up 0.18 m V01.bed.landing@reach → spur boathouse.bed.reach@reach on lines 0, 1.5, 3 m |
| MAJOR | drive-lip | 3528 | [1297.5, 7.7, 1380.6] | -0.188 m | rev/centre | step down 0.19 m between spur boathouse.bed.reach@reach and V01.bed.landing@reach |
| MAJOR | junction-lip | 3530.5 | [1298.9, 7.4, 1376.1] | -0.469 m step | static (5×) | junction cross.v01.spurBoathouse.1 (V01 × spur boathouse): 5 lips > 0.08 m; worst on other+ at 4.11 m: step down 0.47 m V01.bed.landing@reach → spur boathouse.bed.reach@reach |
| MAJOR | missing-guard | 3534 | [1303.4, 8.1, 1379.2] | 1.26 m drop | static | right edge: 1.26 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | seam | 3537.1 | [1307.3, 7.5, 1381.3] | -0.804 m step | static | crack 0.80 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | seam | 3540.2 | [1310.3, 7.5, 1380.3] | -0.968 m step | static | crack 0.97 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MAJOR | seam | 3543.3 | [1312.9, 7.6, 1377.9] | -1.002 m step | static | crack 1.00 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | missing-guard | 3544 | [1313, 8.7, 1376.2] | 1.26 m drop | static | right edge: 1.26 m drop at 4.25 m from centre with no guard (onto S3.surface.2.reach@reach) over 2 m |
| MAJOR | lip | 3545.5–3545.6 | [1313.3, 9, 1372.9] | 0.233 m step | static | step up 0.23 m V01.bed.reach@reach → quayBridge.deck@reach on lines -3, -1.5, 0, 1.5, 3 m |
| MAJOR | transition | 3545.5 | [1323.3, 4.7, 1373.3] | -4.271 m step | static | structure.quayBridge start: structure bed 9 vs road bed 8.77 (Δ 0.23 m, plan offset 0.03 m); 18 lips > 0.08 m within ±15 m, worst on line 1.5 m at 9 m: crack 4.27 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) |
| MAJOR | drive-lip | 3545.5 | [1314.5, 9, 1375.7] | 0.225 m | fwd/centre, fwd/right+2 (2×) | step up 0.23 m between V01.bed.reach@reach and quayBridge.deck@reach |
| MAJOR | drive-lip | 3545.5 | [1314.4, 8.8, 1375.8] | -0.229 m | rev/centre, rev/right+2 (2×) | step down 0.23 m between quayBridge.deck@reach and V01.bed.reach@reach |
| MAJOR | obstruction | 3552 | [1320.4, 9, 1373.1] | 2.75 m from centre | static | parapet/rail S3.edges.reach@reach inside the carriageway at 2.75 m from centre |
| MAJOR | junction-lip | 3553.5 | [1323.9, 6.8, 1374.7] | -2.169 m step | static (5×) | junction cross.s3.v01.3 (V01 × S3): 5 lips > 0.08 m; worst on road+3 at 0.9 m: crack 2.17 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) |
| MAJOR | junction-lip | 3553.5 | [1323.9, 6.8, 1374.7] | -2.169 m step | static (5×) | junction cross.s3.v01.4 (V01 × S3): 5 lips > 0.08 m; worst on road+3 at 0.9 m: crack 2.17 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) |
| MAJOR | seam | 3554.4–3554.5 | [1323.3, 4.7, 1373.3] | -4.271 m step | static | crack 4.27 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3, 1.5 m |
| MAJOR | seam | 3559.5–3559.6 | [1327.8, 6.8, 1370.7] | -2.17 m step | static | crack 2.17 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3, 1.5 m |
| MAJOR | seam | 3564.4 | [1332.8, 7.8, 1369.2] | -1.213 m step | static | crack 1.21 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | seam | 3569 | [1336.6, 6.9, 1366.2] | -2.111 m step | static | crack 2.11 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | seam | 3573.4–3573.5 | [1339, 3.2, 1362] | -5.762 m step | static | crack 5.76 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3, 1.5 m |
| MAJOR | seam | 3577.7 | [1343.1, 0.8, 1359.8] | -8.187 m step | static | crack 8.19 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | seam | 3581.8 | [1345.8, 0.7, 1356.6] | -8.314 m step | static | crack 8.31 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | seam | 3585.8 | [1348.3, 0.7, 1353.2] | -8.35 m step | static | crack 8.35 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | seam | 3589.7 | [1350.5, 0.6, 1349.9] | -8.36 m step | static | crack 8.36 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MAJOR | seam | 3593.5 | [1352.6, 0.7, 1346.5] | -8.302 m step | static | crack 8.30 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MAJOR | junction-lip | 3593.5 | [1350.5, 0.6, 1349.9] | -8.36 m step | static (2×) | junction cross.s3.v01.1 (V01 × S3): 2 lips > 0.08 m; worst on road+3 at -3.8 m: crack 8.36 m deep, 0.2 m wide between prisms (quayBridge.deck@reach \| terrain showing) |
| MAJOR | junction-lip | 3593.5 | [1350.5, 0.6, 1349.9] | -8.36 m step | static (2×) | junction cross.s3.v01.2 (V01 × S3): 2 lips > 0.08 m; worst on road+3 at -3.8 m: crack 8.36 m deep, 0.2 m wide between prisms (quayBridge.deck@reach \| terrain showing) |
| MAJOR | seam | 3600 | [1354.2, 0.9, 1339.7] | -8.066 m step | static | crack 8.07 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5 m |
| MAJOR | seam | 3604.1 | [1357.1, 1, 1336.3] | -8.011 m step | static | crack 8.01 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MAJOR | seam | 3608.5 | [1358.5, 2.1, 1332.1] | -6.926 m step | static | crack 6.93 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MAJOR | seam | 3613.4 | [1360, 4.6, 1327.3] | -4.39 m step | static | crack 4.39 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MAJOR | seam | 3641 | [1366.8, 8.1, 1300.3] | -0.954 m step | static | crack 0.95 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MAJOR | transition | 3641.5 | [1366.8, 8.1, 1300.3] | -0.954 m step | static | structure.quayBridge end: structure bed 9 vs road bed 9 (Δ 0 m, plan offset 0.01 m); 2 lips > 0.08 m within ±15 m, worst on line 3 m at -0.5 m: crack 0.95 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) |
| MAJOR | seam | 3655.2 | [1369.6, 8.4, 1286.3] | -0.698 m step | static | crack 0.70 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MAJOR | missing-guard | 3668 | [1368.6, 9.2, 1273.1] | 2.98 m drop | static | left edge: 2.98 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | missing-guard | 3668–3672 | [1368.6, 9.2, 1273.1] | 1.61 m drop | static | right edge: 1.61 m drop at 5.25 m from centre with no guard (onto terrain) over 6 m |
| MAJOR | junction-lip | 3668.5 | [1363.9, 9.1, 1270.1] | -0.173 m step | static (2×) | junction cross.v01.walkReach.1 (V01 × walk reach): 2 lips > 0.08 m; worst on other+ at 5.47 m: step down 0.17 m V01.shoulders.reach@reach → walk reach.bed.reach@reach |
| MAJOR | floating-edge | 3670–3672 | [1368.9, 9.2, 1271.2] | 2.54 m gap | static | left deck edge hangs 2.54 m over the terrain with no retaining wall or parapet, over 4 m |
| MAJOR | missing-guard | 3672 | [1369.1, 9.3, 1269.2] | 2.89 m drop | static | left edge: 2.89 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | missing-guard | 3678 | [1369.8, 9.5, 1263.2] | 1.28 m drop | static | left edge: 1.28 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | grade | 3778–3812 | [1362.9, 17.8, 1148.3] | 12 % max | static | 34 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum |
| MAJOR | seam | 3793.9 | [1360, 17.1, 1147.5] | -0.661 m step | static | crack 0.66 m deep, 0.2 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3 m |
| MINOR | grade | 6–36 | [1407.8, 24, 1058.2] | 12 % max | static | 30 m over 8 % (max 12 % per 10 m) |
| MINOR | verge-drop | 12 | [1411.7, 23.5, 1057.4] | 1.31 m drop | static | left: 1.31 m drop 8 m from centre (beyond the 5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 14–16 | [1413.7, 23.3, 1056.9] | 0.6 m drop | static | right edge: 0.6 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 20–22 | [1419.5, 22.5, 1055.7] | 0.84 m drop | static | right edge: 0.84 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 58–72 | [1462.3, 19.1, 1045.5] | 1.06 m drop | static | right edge: 1.06 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 74.8 | [1473.6, 18, 1045.4] | -0.433 m step | static | crack 0.43 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| town.upperStreet.slab@harbour showing) on lines 3 m |
| MINOR | seam | 79 | [1477.2, 18, 1042.7] | -0.25 m step | static | crack 0.25 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| terrain showing) on lines 1.5, 3 m |
| MINOR | junction-lip | 82.5 | [1477.7, 18, 1044.1] | -0.215 m step | static (3×) | junction cross.v01.spurUpperStreet.1 (V01 × spur upperStreet): 3 lips > 0.08 m; worst on road+3 at -3.5 m: crack 0.21 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| spur upperStreet.bed.harbour@harbour showing) |
| MINOR | drive-lip | 84.5 | [1482.6, 17.9, 1041.2] | -0.143 m | fwd/right+2 | step down 0.14 m between spur upperStreet.bed.harbour@harbour and V01.bed.harbour@harbour |
| MINOR | buried | 106 | [1500.3, 16.1, 1028] | 0.087 m terrain above deck | static | visible terrain 0.087 m above the deck inside the carriageway over 2 m |
| MINOR | scenery | 114–124 | [1509, 15.1, 1027.8] | 2 m from centre | static | parapet/rail yearWalk.edges.harbour@harbour inside the carriageway (2 m from centre, lowest face 3 m above the deck) |
| MINOR | seam | 115.3 | [1511.5, 14.5, 1029.9] | -0.445 m step | static | crack 0.44 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| yearWalk.shoulders.harbour@harbour showing) on lines 3 m |
| MINOR | grade | 118–164 | [1514.4, 14.8, 1025.1] | 11.45 % max | static | 46 m over 8 % (max 11.4 % per 10 m) |
| MINOR | seam | 120.7 | [1515.7, 14.5, 1026.1] | -0.39 m step | static | crack 0.39 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| yearWalk.bed.harbour@harbour showing) on lines 1.5, 3 m |
| MINOR | seam | 123.3 | [1518, 14.9, 1024.8] | -0.308 m step | static | crack 0.31 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| terrain showing) on lines 1.5, 3 m |
| MINOR | lip | 142.3 | [1533.9, 17.2, 1013.9] | 0.087 m step | static | step up 0.09 m terrain → V01.bed.prow@harbour on lines 1.5 m |
| MINOR | seam | 147.5 | [1537.8, 17.6, 1010.3] | -0.101 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.prow@harbour \| terrain showing) on lines 1.5 m |
| MINOR | drive-lip | 150–154 | [1542.6, 18.4, 1005.4] | 0.129 m | fwd/right+2 (3×) | step up 0.13 m between V01.bed.prow@harbour and yearWalk.shoulders.prow@harbour |
| MINOR | drive-lip | 150 | [1539.8, 17.9, 1008.4] | 0.098 m | fwd/right+2 | step up 0.10 m between terrain and V01.bed.prow@harbour |
| MINOR | lip | 152.6 | [1541.3, 18.1, 1006.4] | -0.088 m step | static | step down 0.09 m V01.bed.prow@harbour → terrain on lines 1.5 m |
| MINOR | lip | 154.1 | [1542.3, 18.4, 1005.2] | 0.128 m step | static | step up 0.13 m V01.bed.prow@harbour → yearWalk.shoulders.prow@harbour on lines 1.5 m |
| MINOR | seam | 163.4 | [1548.8, 18.9, 998.1] | -0.111 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.prow@harbour \| yearWalk.shoulders.prow@harbour showing) on lines 3 m |
| MINOR | seam | 166.8 | [1550.5, 19.1, 995] | -0.17 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (V01.bed.prow@harbour \| yearWalk.shoulders.prow@harbour showing) on lines 3 m |
| MINOR | seam | 174.6 | [1552.9, 19.4, 987.4] | -0.444 m step | static | crack 0.44 m deep, 0.2 m wide between prisms (V01.bed.prow@harbour \| terrain showing) on lines 1.5, 3 m |
| MINOR | grade | 176–186 | [1552.2, 19.9, 985.5] | 8.22 % max | static | 10 m over 8 % (max 8.2 % per 10 m) |
| MINOR | grade | 194–208 | [1560.1, 21, 969.3] | 8.36 % max | static | 14 m over 8 % (max 8.4 % per 10 m) |
| MINOR | lip | 215.8 | [1570.5, 22.7, 950] | 0.099 m step | static | step up 0.10 m terrain → V01.bed.prow@prow on lines 1.5 m |
| MINOR | grade | 238–248 | [1577.7, 24.4, 929] | 9.47 % max | static | 10 m over 8 % (max 9.5 % per 10 m) |
| MINOR | grade | 244–254 | [1579.9, 24.8, 923.4] | 8.03 % max | static | 10 m over 8 % (max 8 % per 10 m) |
| MINOR | surface-mismatch | 247 | [1581.1, 25.3, 920.3] | 0.3 m vs bed | fwd/centre, fwd/right+2 (2×) | rode above the bed line by 0.30 m on plot.terraces.2.layby.slab@prow |
| MINOR | grade | 266–288 | [1590.4, 27.1, 895.3] | 9.23 % max | static | 22 m over 8 % (max 9.2 % per 10 m) |
| MINOR | seam | 282 | [1595.7, 27.7, 888.6] | -0.172 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (V01.bed.prow@prow \| prowTunnel.floor@prow showing) on lines 1.5, 3 m |
| MINOR | grade | 310–322 | [1600.2, 29.9, 858.6] | 8.03 % max | static | 12 m over 8 % (max 8 % per 10 m) |
| MINOR | lip | 325.5 | [1604.3, 30.9, 845.3] | 0.082 m step | static | step up 0.08 m prowTunnel.apron@prow → V01.bed.prow@prow on lines 1.5, 3 m |
| MINOR | lip | 337.6 | [1604.5, 31.9, 833.1] | 0.123 m step | static | step up 0.12 m yearWalk.shoulders.prow@prow → plot.terraces.1.layby.slab@prow on lines 3 m |
| MINOR | junction-lip | 339.5 | [1604.5, 31.9, 833.1] | 0.123 m step | static | junction cross.v01.plotTerraces1Service.1 (V01 × plot.terraces.1.service): 1 lips > 0.08 m; worst on road+3 at -1.9 m: step up 0.12 m yearWalk.shoulders.prow@prow → plot.terraces.1.layby.slab@prow |
| MINOR | grade | 346–366 | [1601.3, 32.4, 822.7] | 8.78 % max | static | 20 m over 8 % (max 8.8 % per 10 m) |
| MINOR | floating-edge | 362–366 | [1600.5, 33.9, 804.7] | 0.39 m gap | static | left deck edge hangs 0.39 m over the terrain with no retaining wall or parapet, over 6 m |
| MINOR | lip | 365.1 | [1597.5, 33.8, 805.8] | -0.147 m step | static | step down 0.15 m yearWalk.shoulders.prow@prow → V01.bed.prow@prow on lines -3 m |
| MINOR | surface-mismatch | 376.5–378 | [1597.7, 35.1, 794.3] | 0.43 m vs bed | rev/right+2 | rode above the bed line by 0.43 m on V03.bed.prow@prow |
| MINOR | grade | 420–442 | [1594.7, 38.8, 741] | 9.43 % max | static | 22 m over 8 % (max 9.4 % per 10 m) |
| MINOR | drive-lip | 455 | [1593.8, 40.7, 715.6] | 0.103 m | fwd/right+2 | step up 0.10 m between V01.bed.prow@prow and yearWalk.shoulders.prow@prow |
| MINOR | drive-lip | 455 | [1593.8, 40.6, 715.7] | -0.109 m | fwd/right+2 | step down 0.11 m between yearWalk.shoulders.prow@prow and V01.bed.prow@prow |
| MINOR | seam | 455.2 | [1594.8, 40.6, 715.6] | -0.111 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (yearWalk.bed.prow@prow \| V01.bed.prow@prow showing) on lines 3 m |
| MINOR | grade | 462–508 | [1587.2, 44, 677.4] | 12 % max | static | 46 m over 8 % (max 12 % per 10 m) |
| MINOR | seam | 486 | [1589.7, 42.9, 685.1] | -0.423 m step | static | crack 0.42 m deep, 0.2 m wide between prisms (V01.bed.prow@prow \| terrain showing) on lines 1.5, 3 m |
| MINOR | unguarded-step | 496–500 | [1586.4, 44.6, 671.5] | 0.76 m drop | static | left edge: 0.76 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 504–506 | [1585.6, 45.3, 665.5] | 0.38 m gap | static | left deck edge hangs 0.38 m over the terrain with no retaining wall or parapet, over 4 m |
| MINOR | seam | 506.4 | [1587, 45.3, 664.9] | -0.184 m step | static | crack 0.18 m deep, 0.2 m wide between prisms (yearWalk.bed.prow@prow \| V01.bed.prow@prow showing) on lines 1.5 m |
| MINOR | unguarded-step | 510–514 | [1585, 45.3, 661.6] | 0.76 m drop | static | left edge: 0.76 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | grade | 618–640 | [1567.5, 53.5, 544.9] | 9.18 % max | static | 22 m over 8 % (max 9.2 % per 10 m) |
| MINOR | lip | 647.1 | [1566, 54.9, 525.8] | 0.1 m step | static | step up 0.10 m terrain → V01.bed.prow@prow on lines 1.5, 3 m |
| MINOR | grade | 662–676 | [1561.7, 56, 509.3] | 8.66 % max | static | 14 m over 8 % (max 8.7 % per 10 m) |
| MINOR | seam | 673.5 | [1562.9, 56.6, 499.4] | -0.285 m step | static | crack 0.29 m deep, 0.2 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 673.5 | [1560.2, 56.8, 500.1] | 0.13 m | rev/centre | step up 0.13 m between terrain and V01.bed.prow@crown |
| MINOR | drive-lip | 673.5 | [1560.2, 56.7, 500] | -0.123 m | rev/centre | step down 0.12 m between V01.bed.prow@crown and terrain |
| MINOR | seam | 678.2 | [1561.9, 56.9, 494.7] | -0.16 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 683 | [1559.7, 57.2, 489.9] | -0.104 m | fwd/right+2 | step down 0.10 m between V01.bed.prow@crown and terrain |
| MINOR | seam | 683.2–683.3 | [1560.8, 57.2, 489.8] | -0.112 m step | static | crack 0.11 m deep, 0.3 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 3, 1.5 m |
| MINOR | drive-lip | 683.5 | [1559.7, 57.3, 489.8] | 0.097 m | fwd/right+2 | step up 0.10 m between terrain and V01.bed.prow@crown |
| MINOR | seam | 686.9 | [1559.7, 57.3, 486.1] | -0.194 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | grade | 694–708 | [1552.8, 58.1, 478.9] | 8.31 % max | static | 14 m over 8 % (max 8.3 % per 10 m) |
| MINOR | seam | 705.7 | [1543.6, 58.6, 473.8] | -0.303 m step | static | crack 0.30 m deep, 0.3 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 709 | [1546.6, 58.9, 467.6] | -0.262 m step | static | crack 0.26 m deep, 0.2 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 3 m |
| MINOR | seam | 713.2 | [1544, 59.1, 464.1] | -0.268 m step | static | crack 0.27 m deep, 0.2 m wide between prisms (V01.bed.prow@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | grade | 716–736 | [1534.9, 60.2, 457.5] | 9.42 % max | static | 20 m over 8 % (max 9.4 % per 10 m) |
| MINOR | drive-lip | 747 | [1518.9, 61.9, 441.1] | 0.123 m | rev/right+2 | step up 0.12 m between terrain and V01.bed.crown@crown |
| MINOR | drive-lip | 747 | [1518.9, 61.8, 441] | -0.122 m | rev/right+2 | step down 0.12 m between V01.bed.crown@crown and terrain |
| MINOR | grade | 758–784 | [1506.1, 63.6, 421.7] | 9.12 % max | static | 26 m over 8 % (max 9.1 % per 10 m) |
| MINOR | drive-lip | 785.5 | [1497.5, 64.7, 408.1] | -0.135 m | fwd/right+2 | step down 0.13 m between V01.bed.crown@crown and terrain |
| MINOR | drive-lip | 786 | [1497.4, 64.9, 408] | 0.132 m | fwd/right+2 | step up 0.13 m between terrain and V01.bed.crown@crown |
| MINOR | seam | 789.7 | [1494.6, 65, 405.5] | -0.144 m step | static | crack 0.14 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 793.2 | [1493.3, 65.1, 401.9] | -0.249 m step | static | crack 0.25 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3 m |
| MINOR | grade | 800–824 | [1477.8, 66.7, 390.6] | 9.2 % max | static | 24 m over 8 % (max 9.2 % per 10 m) |
| MINOR | seam | 827.4 | [1464.8, 67.7, 381.8] | -0.234 m step | static | crack 0.23 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines -3, -1.5 m |
| MINOR | drive-lip | 831.5 | [1462.6, 68.2, 378.1] | 0.115 m | rev/right+2 | step up 0.12 m between terrain and V01.bed.crown@crown |
| MINOR | seam | 831.7 | [1461.8, 68.1, 378.6] | -0.12 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines -3 m |
| MINOR | drive-lip | 832 | [1462.6, 68.1, 378] | -0.112 m | rev/right+2 | step down 0.11 m between V01.bed.crown@crown and terrain |
| MINOR | lip | 835.3 | [1459.3, 68.4, 375.8] | -0.081 m step | static | step down 0.08 m V01.bed.crown@crown → terrain on lines -3, -1.5 m |
| MINOR | seam | 839 | [1458.1, 68.6, 371.9] | -0.123 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 843.4 | [1454.3, 68.7, 369.2] | -0.189 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines -3 m |
| MINOR | seam | 874.9 | [1439.6, 70.1, 340.9] | -0.102 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 879–883 | [1434.8, 70.3, 334.3] | -0.115 m | fwd/right+2 (2×) | step down 0.11 m between V01.bed.crown@crown and terrain |
| MINOR | seam | 879.2–879.3 | [1436.9, 70.2, 337.4] | -0.096 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3, 1.5 m |
| MINOR | drive-lip | 879.5–883 | [1434.7, 70.4, 334.2] | 0.111 m | fwd/right+2 (2×) | step up 0.11 m between terrain and V01.bed.crown@crown |
| MINOR | seam | 882.9 | [1435.5, 70.3, 333.6] | -0.115 m step | static | crack 0.12 m deep, 0.3 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3 m |
| MINOR | seam | 886.6 | [1432.8, 70.3, 330.9] | -0.175 m step | static | crack 0.18 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 891 | [1429.6, 70.4, 327.8] | -0.193 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 898.5 | [1423.3, 70.9, 323.4] | 0.146 m | fwd/right+2 | step up 0.15 m between terrain and V01.bed.crown@crown |
| MINOR | drive-lip | 898.5 | [1423.4, 70.7, 323.5] | -0.147 m | fwd/right+2 | step down 0.15 m between V01.bed.crown@crown and terrain |
| MINOR | seam | 916.9 | [1409.5, 71.7, 311] | -0.299 m step | static | crack 0.30 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3 m |
| MINOR | seam | 921.7 | [1404.6, 71.9, 309.3] | -0.25 m step | static | crack 0.25 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | lip | 925.9 | [1401.9, 72.3, 305.7] | -0.086 m step | static | step down 0.09 m V01.bed.crown@crown → terrain on lines 1.5, 3 m |
| MINOR | drive-lip | 926 | [1401.3, 72.3, 306.6] | -0.084 m | fwd/right+2 | step down 0.08 m between V01.bed.crown@crown and terrain |
| MINOR | lip | 937.9 | [1389.5, 72.9, 302.4] | 0.092 m step | static | step up 0.09 m terrain → V01.bed.crown@crown on lines 1.5, 3 m |
| MINOR | seam | 959.4 | [1367.5, 74, 302.9] | -0.152 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 962.1 | [1364.8, 74.1, 302.3] | -0.114 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines -3 m |
| MINOR | seam | 964.8 | [1362.4, 74.2, 300.3] | -0.095 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines -1.5 m |
| MINOR | drive-lip | 965 | [1362.4, 74.3, 301] | 0.096 m | rev/right+2 | step up 0.10 m between terrain and V01.bed.crown@crown |
| MINOR | drive-lip | 965 | [1362.2, 74.2, 300.9] | -0.093 m | rev/right+2 | step down 0.09 m between V01.bed.crown@crown and terrain |
| MINOR | lip | 969.9 | [1357.4, 74.5, 298.8] | 0.095 m step | static | step up 0.10 m terrain → V01.bed.crown@crown on lines -1.5 m |
| MINOR | seam | 994.2 | [1339.6, 74.3, 282] | -0.115 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 996.7 | [1338.8, 74.2, 279.2] | -0.098 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3 m |
| MINOR | seam | 1021.5 | [1317.8, 73, 265.1] | -0.24 m step | static | crack 0.24 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5 m |
| MINOR | lip | 1023.6–1024.5 | [1316.5, 73.1, 262.7] | -0.11 m step | static | step down 0.11 m yearWalk.shoulders.crown@crown → V01.bed.crown@crown on lines 3 m |
| MINOR | lip | 1027.5 | [1312.9, 72.9, 260.9] | 0.088 m step | static | step up 0.09 m terrain → V01.bed.crown@crown on lines 1.5, 3 m |
| MINOR | drive-lip | 1036.5–1039.5 | [1300.4, 72.1, 258] | -0.14 m | fwd/right+2 (2×) | step down 0.14 m between V01.bed.crown@crown and terrain |
| MINOR | drive-lip | 1037–1040 | [1300.3, 72.2, 257.9] | 0.149 m | fwd/right+2 (2×) | step up 0.15 m between terrain and V01.bed.crown@crown |
| MINOR | seam | 1039.8 | [1300.3, 72.1, 258.5] | -0.138 m step | static | crack 0.14 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5 m |
| MINOR | lip | 1046.1 | [1294.2, 71.8, 256] | -0.098 m step | static | step down 0.10 m yearWalk.shoulders.crown@crown → V01.bed.crown@crown on lines 3 m |
| MINOR | seam | 1048 | [1292.3, 71.5, 255.7] | -0.112 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3 m |
| MINOR | lip | 1063.1 | [1277.2, 70.8, 253.8] | 0.081 m step | static | step up 0.08 m terrain → V01.bed.crown@crown on lines 3 m |
| MINOR | seam | 1086.8 | [1253.6, 69.4, 251.4] | -0.101 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 3 m |
| MINOR | unguarded-step | 1106–1116 | [1224.2, 67.7, 252.1] | 1.15 m drop | static | left edge: 1.15 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | drive-lip | 1207.5 | [1132.4, 62.1, 247.4] | -0.091 m | fwd/right+2 | step down 0.09 m between V01.bed.crown@crown and terrain |
| MINOR | drive-lip | 1208 | [1132.2, 62.2, 247.4] | 0.093 m | fwd/right+2 | step up 0.09 m between terrain and V01.bed.crown@crown |
| MINOR | seam | 1220.3 | [1119.9, 61.4, 248.5] | -0.083 m step | static | crack 0.08 m deep, 0.2 m wide between prisms (V01.bed.crown@crown \| terrain showing) on lines 1.5 m |
| MINOR | lip | 1227.1 | [1113.1, 61, 249.1] | 0.084 m step | static | step up 0.08 m terrain → V01.bed.hollow@crown on lines 1.5 m |
| MINOR | drive-lip | 1230.5 | [1109.3, 60.7, 249.1] | 0.094 m | fwd/right+2 | step up 0.09 m between terrain and V01.bed.hollow@crown |
| MINOR | drive-lip | 1230.5 | [1109.4, 60.7, 249] | -0.092 m | fwd/right+2 | step down 0.09 m between V01.bed.hollow@crown and terrain |
| MINOR | seam | 1230.7 | [1109.5, 60.7, 249.6] | -0.091 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.hollow@crown \| terrain showing) on lines 1.5 m |
| MINOR | seam | 1234.6–1234.7 | [1105.6, 60.4, 250.1] | -0.097 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.hollow@crown \| terrain showing) on lines 1.5, 3 m |
| MINOR | unguarded-step | 1240–1246 | [1100.4, 60.2, 252.3] | 1.07 m drop | static | left edge: 1.07 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | lip | 1247.6 | [1092.7, 59.8, 251.9] | 0.09 m step | static | step up 0.09 m terrain → V01.bed.hollow@crown on lines 1.5 m |
| MINOR | unguarded-step | 1270–1274 | [1068.9, 58.4, 257.6] | 1.12 m drop | static | left edge: 1.12 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 1274.9 | [1065.5, 58.1, 255.1] | -0.092 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.hollow@crown \| yearWalk.shoulders.hollow@crown showing) on lines 3 m |
| MINOR | unguarded-step | 1296–1298 | [1043.3, 56.8, 262.4] | 1.04 m drop | static | left edge: 1.04 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 1322–1324 | [1019.8, 55.3, 267.1] | 0.99 m drop | static | left edge: 0.99 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 1348–1350 | [994.3, 53.8, 272.3] | 0.94 m drop | static | left edge: 0.94 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 1372–1374 | [968.8, 52.2, 277.5] | 0.81 m drop | static | left edge: 0.81 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | verge-drop | 1378 | [964.9, 52, 278.3] | 1.77 m drop | static | left: 1.77 m drop 6.75 m from centre (beyond the 5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 1390 | [953.2, 51.2, 280.7] | 1.13 m drop | static | left edge: 1.13 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 1394 | [949.2, 50.9, 281.4] | 0.78 m drop | static | left edge: 0.78 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 1429.6 | [914.7, 48.8, 290.9] | -0.175 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines -3 m |
| MINOR | seam | 1444 | [900.4, 48, 293] | -0.139 m step | static | crack 0.14 m deep, 0.3 m wide between prisms (VG.bed.scholars@scholars \| V01.bed.scholars@scholars showing) on lines -3 m |
| MINOR | drive-lip | 1447 | [897.5, 48, 292.3] | 0.107 m | rev/right+2 | step up 0.11 m between V01.bed.scholars@scholars and VG.bed.scholars@scholars |
| MINOR | lip | 1455 | [889.2, 47.6, 292.6] | -0.117 m step | static | step down 0.12 m spur library.bed.scholars@scholars → V01.bed.scholars@scholars on lines -1.5 m |
| MINOR | drive-lip | 1456.5 | [888, 47.7, 293.2] | 0.137 m | rev/right+2 | step up 0.14 m between V01.bed.scholars@scholars and spur library.bed.scholars@scholars |
| MINOR | scenery | 1464 | [880.1, 47.3, 291.8] | 5 m from centre | static | kerb/wall spur library.kerbs.scholars@scholars within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | drive-lip | 1475 | [869.4, 47, 294.4] | 0.093 m | rev/right+2 | step up 0.09 m between terrain and V01.bed.scholars@scholars |
| MINOR | drive-lip | 1475 | [869.2, 46.9, 294.4] | -0.093 m | rev/right+2 | step down 0.09 m between V01.bed.scholars@scholars and terrain |
| MINOR | drive-lip | 1537 | [806.9, 45, 294.1] | -0.117 m | fwd/centre, fwd/right+2 (2×) | step down 0.12 m between yearWalk.shoulders.scholars@scholars and V01.bed.scholars@scholars |
| MINOR | seam | 1539.5 | [804.6, 44.4, 292.7] | -0.521 m step | static | crack 0.52 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | unguarded-step | 1540–1544 | [800.1, 44.8, 294.3] | 0.6 m drop | static | left edge: 0.6 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 1540–1542 | [802.1, 44.9, 294.2] | 0.57 m drop | static | right edge: 0.57 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | drive-lip | 1596.5 | [747.3, 43.3, 294.5] | 0.128 m | fwd/right+2 | step up 0.13 m between terrain and V01.bed.scholars@scholars |
| MINOR | drive-lip | 1596.5 | [747.5, 43.1, 294.5] | -0.127 m | fwd/right+2 | step down 0.13 m between V01.bed.scholars@scholars and terrain |
| MINOR | seam | 1605.4 | [738.6, 42.9, 295.8] | -0.109 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 1609.5 | [734.3, 42.9, 295.8] | 0.085 m | fwd/right+2 | step up 0.09 m between terrain and V01.bed.scholars@scholars |
| MINOR | drive-lip | 1609.5 | [734.4, 42.9, 295.8] | -0.084 m | fwd/right+2 | step down 0.08 m between V01.bed.scholars@scholars and terrain |
| MINOR | seam | 1609.6 | [734.3, 42.9, 294.8] | -0.086 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1613.6 | [730.3, 42.7, 295.3] | -0.154 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1617.4 | [726.4, 42.6, 295.8] | -0.143 m step | static | crack 0.14 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1621 | [723.1, 42.5, 297.9] | -0.157 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1624.4 | [719.7, 42.4, 298.5] | -0.163 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1628 | [715.8, 42.3, 297.8] | -0.126 m step | static | crack 0.13 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1631.8 | [712.1, 42.2, 298.7] | -0.121 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1635.8 | [708.2, 42.1, 299.7] | -0.124 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1640 | [704.1, 42, 300.8] | -0.116 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1644.4 | [699.8, 41.9, 302] | -0.108 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1663.5 | [681.4, 41.4, 307.6] | -0.243 m step | static | crack 0.24 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | junction-lip | 1664 | [681.4, 41.4, 307.6] | -0.243 m step | static (2×) | junction cross.v01.walkCoveWalk.1 (V01 × walk coveWalk): 2 lips > 0.08 m; worst on road+3 at -0.5 m: crack 0.24 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) |
| MINOR | unguarded-step | 1668–1676 | [672.4, 41.4, 313.7] | 0.73 m drop | static | right edge: 0.73 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 1670–1674 | [674.3, 41.5, 313.1] | 0.68 m drop | static | left edge: 0.68 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 1681.8 | [664, 41.2, 313.4] | -0.118 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1684.5 | [661.4, 41.1, 314.3] | -0.103 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1709.3 | [638.1, 40.5, 322.8] | -0.105 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1723.2 | [625.6, 39.9, 329.2] | -0.16 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1734.2 | [614.8, 39.5, 331.9] | -0.131 m step | static | crack 0.13 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1783.8 | [569.2, 37.2, 352] | -0.186 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (V01.bed.flats@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1791.9 | [561.9, 37.1, 355.6] | -0.154 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.flats@scholars \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 1795.5 | [558.9, 37.2, 358.3] | 0.125 m | fwd/right+2 | step up 0.12 m between terrain and V01.bed.flats@scholars |
| MINOR | drive-lip | 1795.5 | [559.1, 37, 358.2] | -0.125 m | fwd/right+2 | step down 0.13 m between V01.bed.flats@scholars and terrain |
| MINOR | seam | 1845.2 | [515.2, 38.1, 381.6] | -0.1 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.flats@scholars \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 1879.5 | [486.1, 38.3, 400.2] | 0.083 m | fwd/right+2 | step up 0.08 m between terrain and V01.bed.flats@scholars |
| MINOR | drive-lip | 1879.5 | [486.2, 38.2, 400.2] | -0.083 m | fwd/right+2 | step down 0.08 m between V01.bed.flats@scholars and terrain |
| MINOR | seam | 1882.5 | [483.2, 38.2, 400.9] | -0.094 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.flats@scholars \| terrain showing) on lines 3 m |
| MINOR | seam | 1909.1 | [460.7, 37.5, 415.3] | -0.155 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1920.7 | [452, 37.1, 423.1] | -0.155 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1926.4 | [447.3, 37, 426.4] | -0.147 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 1929 | [444.7, 36.9, 427.6] | -0.129 m | fwd/right+2 | step down 0.13 m between V01.bed.flats@flats and terrain |
| MINOR | drive-lip | 1929 | [444.6, 37, 427.7] | 0.129 m | fwd/right+2 | step up 0.13 m between terrain and V01.bed.flats@flats |
| MINOR | seam | 1953.3 | [424.7, 36.1, 441.4] | -0.116 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 1976 | [408, 35.6, 457.6] | -0.148 m | fwd/right+2 | step down 0.15 m between V01.bed.flats@flats and terrain |
| MINOR | seam | 1976.3 | [407.3, 35.6, 456.9] | -0.132 m step | static | crack 0.13 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 1976.5 | [407.9, 35.7, 457.6] | 0.15 m | fwd/right+2 | step up 0.15 m between terrain and V01.bed.flats@flats |
| MINOR | seam | 1980.2 | [404.5, 35.5, 459.8] | -0.144 m step | static | crack 0.14 m deep, 0.3 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | seam | 1984 | [403, 35.3, 463.7] | -0.172 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1987.5 | [400.8, 35.2, 466.4] | -0.175 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1990.8 | [398.8, 35.2, 469.1] | -0.149 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 1994–1998 | [396.4, 35.1, 471.8] | -0.113 m | fwd/right+2 (2×) | step down 0.11 m between V01.bed.flats@flats and terrain |
| MINOR | drive-lip | 1994–1998 | [396.4, 35.2, 471.9] | 0.115 m | fwd/right+2 (2×) | step up 0.12 m between terrain and V01.bed.flats@flats |
| MINOR | seam | 1994.2 | [395.6, 35.1, 471.3] | -0.103 m step | static | crack 0.10 m deep, 0.3 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | seam | 1997.9 | [395, 35.1, 475.3] | -0.096 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 2001.8 | [391.8, 35, 478.2] | -0.105 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 2005.9 | [390, 34.9, 482] | -0.114 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 2010.2 | [389.6, 34.8, 486.6] | -0.11 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 2014.5 | [387.4, 34.8, 490.5] | -0.095 m | fwd/right+2 | step down 0.09 m between V01.bed.flats@flats and terrain |
| MINOR | drive-lip | 2014.5 | [387.3, 34.9, 490.7] | 0.096 m | fwd/right+2 | step up 0.10 m between terrain and V01.bed.flats@flats |
| MINOR | seam | 2014.7 | [387.9, 34.8, 490.8] | -0.096 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | lip | 2024.2–2024.3 | [383.2, 34.8, 499.4] | 0.095 m step | static | step up 0.09 m terrain → V01.bed.flats@flats on lines 1.5, 3 m |
| MINOR | seam | 2029.2 | [381.6, 34.6, 504] | -0.104 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 2031.5 | [381.8, 34.6, 506.8] | -0.102 m | fwd/right+2 | step down 0.10 m between V01.bed.flats@flats and terrain |
| MINOR | drive-lip | 2031.5 | [381.7, 34.7, 506.9] | 0.103 m | fwd/right+2 | step up 0.10 m between terrain and V01.bed.flats@flats |
| MINOR | seam | 2039.6 | [378.6, 34.5, 514.1] | -0.091 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 2047.5 | [377.3, 34.4, 522.2] | -0.087 m | fwd/right+2 | step down 0.09 m between V01.bed.flats@flats and terrain |
| MINOR | drive-lip | 2047.5 | [377.3, 34.5, 522.4] | 0.087 m | fwd/right+2 | step up 0.09 m between terrain and V01.bed.flats@flats |
| MINOR | lip | 2061.8 | [374.4, 34.4, 536.1] | 0.094 m step | static | step up 0.09 m terrain → V01.bed.flats@flats on lines 1.5, 3 m |
| MINOR | lip | 2070.4 | [371.1, 34.3, 544.2] | 0.091 m step | static | step up 0.09 m terrain → V01.bed.flats@flats on lines 3 m |
| MINOR | lip | 2084.9 | [368.2, 34.3, 558.5] | 0.088 m step | static | step up 0.09 m terrain → V01.bed.flats@flats on lines 3 m |
| MINOR | lip | 2180.1 | [357, 33.8, 653.4] | 0.094 m step | static | step up 0.09 m terrain → V01.bed.flats@flats on lines 1.5, 3 m |
| MINOR | lip | 2183.7 | [357, 33.8, 657.1] | 0.09 m step | static | step up 0.09 m terrain → V01.bed.flats@flats on lines 1.5, 3 m |
| MINOR | lip | 2187.5 | [357.1, 33.7, 661] | 0.083 m step | static | step up 0.08 m terrain → V01.bed.flats@flats on lines 1.5, 3 m |
| MINOR | drive-lip | 2209 | [359.5, 33.2, 682.8] | -0.086 m | fwd/right+2 | step down 0.09 m between V01.bed.flats@flats and terrain |
| MINOR | seam | 2209.3–2209.4 | [360, 33.2, 682.7] | -0.092 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 2209.5 | [359.5, 33.3, 682.9] | 0.086 m | fwd/right+2 | step up 0.09 m between terrain and V01.bed.flats@flats |
| MINOR | seam | 2219.2 | [359.4, 32.8, 692.8] | -0.207 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | seam | 2240.4 | [361.9, 31.6, 713.9] | -0.234 m step | static | crack 0.23 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | seam | 2262.9 | [365, 30.4, 736.2] | -0.219 m step | static | crack 0.22 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | seam | 2305.9 | [372, 27.8, 778.8] | -0.243 m step | static | crack 0.24 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | seam | 2350.6 | [380.6, 25, 822.7] | -0.301 m step | static | crack 0.30 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | grade | 2392–2426 | [399.1, 27.3, 883.5] | 11.86 % max | static | 34 m over 8 % (max 11.9 % per 10 m) |
| MINOR | seam | 2395 | [391.2, 25.1, 866] | -0.382 m step | static | crack 0.38 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 2408.7 | [394.8, 26.3, 879.2] | -0.391 m step | static | crack 0.39 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 3 m |
| MINOR | unguarded-step | 2416 | [399.7, 27.4, 885.5] | 0.74 m drop | static | right edge: 0.74 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | scenery | 2420 | [400.8, 27.9, 889.3] | 5 m from centre | static | parapet/rail walk bightPier.edges.flats@flats within 1 m of it (5 m from centre, lowest face 1.25 m above the deck) |
| MINOR | scenery | 2420 | [400.8, 27.9, 889.3] | 5 m from centre | static | retainingWall/wall walk bightPier.retaining.flats@flats within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | lip | 2421.9–2423.6 | [400.1, 28.3, 892.3] | 0.129 m step | static | step up 0.13 m V01.bed.flats@flats → walk bightPier.bed.flats@flats on lines 3, 1.5, 0 m |
| MINOR | drive-lip | 2422.5–2426.5 | [399.5, 28.3, 892.2] | 0.123 m | fwd/centre, fwd/right+2, rev/centre (3×) | step up 0.12 m between V01.bed.flats@flats and walk bightPier.bed.flats@flats |
| MINOR | drive-lip | 2423.5 | [401.7, 28.3, 892.6] | -0.128 m | rev/centre | step down 0.13 m between walk bightPier.bed.flats@flats and V01.bed.flats@flats |
| MINOR | junction-lip | 2425 | [401.8, 28.4, 892.8] | 0.127 m step | static (4×) | junction cross.v01.walkBightPier.1 (V01 × walk bightPier): 4 lips > 0.08 m; worst on road+0 at -1.4 m: step up 0.13 m V01.bed.flats@flats → walk bightPier.bed.flats@flats |
| MINOR | lip | 2426.5–2428.3 | [406, 28.2, 896.4] | -0.091 m step | static | step down 0.09 m walk bightPier.bed.flats@flats → V01.bed.flats@flats on lines 0, -1.5, -3 m |
| MINOR | verge-drop | 2428 | [403, 28.2, 897] | 5.71 m drop | static | left: 5.71 m drop 7.75 m from centre (beyond the 5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 2446 | [408.2, 26.1, 914.2] | 0.81 m drop | static | right edge: 0.81 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2452 | [410, 25.4, 919.9] | 1.08 m drop | static | right edge: 1.08 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2460–2462 | [412.5, 24.4, 927.6] | 1.15 m drop | static | right edge: 1.15 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2474–2476 | [416.9, 22.7, 940.8] | 0.99 m drop | static | right edge: 0.99 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2484 | [420.3, 21.5, 950.3] | 0.92 m drop | static | right edge: 0.92 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2488 | [421.6, 21.1, 954] | 1 m drop | static | right edge: 1 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2500–2502 | [425.9, 19.6, 965.2] | 1.22 m drop | static | right edge: 1.22 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2512–2514 | [431.1, 18, 978.2] | 0.82 m drop | static | right edge: 0.82 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2522–2526 | [435.1, 16.8, 987.4] | 0.8 m drop | static | right edge: 0.8 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 2528.2 | [435.5, 15.8, 991.8] | -0.436 m step | static | crack 0.44 m deep, 0.2 m wide between prisms (V01.bed.flats@flats \| terrain showing) on lines 1.5, 3 m |
| MINOR | unguarded-step | 2532–2552 | [439.4, 15.6, 996.4] | 1.09 m drop | static | left edge: 1.09 m step off at 4.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2542–2544 | [443.9, 14.5, 1005.3] | 0.89 m drop | static | right edge: 0.89 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 2548 | [443.2, 13.9, 1010.3] | -0.236 m step | static | crack 0.24 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines 1.5, 3 m |
| MINOR | unguarded-step | 2550 | [446.8, 14, 1010.6] | 0.68 m drop | static | right edge: 0.68 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 2562–2568 | [454.3, 12.8, 1022.4] | 0.75 m gap | static | left deck edge hangs 0.75 m over the terrain with no retaining wall or parapet, over 8 m |
| MINOR | unguarded-step | 2568–2572 | [456.6, 12.5, 1025.7] | 1.12 m drop | static | right edge: 1.12 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | double-parapet | 2588–3640 | — | 92 station-sides | static | two or more rail solids on one side of the deck at 92 station-sides (V01.edges.bight@bight, bightBridge.rails@bight, V01.edges.offshore@bight, V01.edges.reach@reach, quayBridge.rails@reach, crossing.cross.s3.riverLower.1.rails@reach, S3.edges.reach@reach) |
| MINOR | transition | 2705.5 | — | 5.6 m step | static | structure.bightBridge.s2Ramp.sea start: structure bed 17.6 vs road bed 12 (Δ 5.6 m, plan offset 2.96 m); no lip > 0.08 m within ±15 m |
| MINOR | transition | 2705.5 | — | 5.6 m step | static | structure.bightBridge.s2Flyover end: structure bed 17.6 vs road bed 12 (Δ 5.6 m, plan offset 2.96 m); no lip > 0.08 m within ±15 m |
| MINOR | scenery | 2726–2728 | [582.8, 12, 1119.9] | 0 m from centre | static | beam/support crossing.cross.fERRY.s2.2.beams@bight inside the carriageway (0 m from centre, lowest face 3 m above the deck) |
| MINOR | scenery | 2732–2764 | [587.8, 12, 1123.1] | 2 m from centre | static | handrail/rail bightBridge.s2Ramp.sea.rails@bight inside the carriageway (2 m from centre, lowest face 2 m above the deck) |
| MINOR | scenery | 2818 | [659.9, 12, 1170] | 5 m from centre | static | parapet/rail S2.edges.bight@bight within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | transition | 2818.5 | [663.7, 11.8, 1169] | -0.107 m step | static | structure.bightBridge end: structure bed 12 vs road bed 11.98 (Δ 0.02 m, plan offset 1.81 m); 2 lips > 0.08 m within ±15 m, worst on line -3 m at 2 m: crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| yearWalk.bed.bight@bight showing) |
| MINOR | seam | 2820.5 | [663.7, 11.8, 1169] | -0.107 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| yearWalk.bed.bight@bight showing) on lines -3, -1.5 m |
| MINOR | unguarded-step | 2824–2830 | [664.8, 11.7, 1173.5] | 0.89 m drop | static | right edge: 0.89 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2872–2886 | [710.3, 9.4, 1209.4] | 1.13 m drop | static | right edge: 1.13 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 2877.3 | [708.6, 9.4, 1204.1] | -0.188 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines -3, -1.5 m |
| MINOR | unguarded-step | 2902–2908 | [725.8, 9.1, 1222.1] | 0.99 m drop | static | right edge: 0.99 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 2914.8 | [733.7, 8.9, 1232.6] | -0.197 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines 3 m |
| MINOR | seam | 2933.3 | [748.1, 8.8, 1244.3] | -0.246 m step | static | crack 0.25 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 2949.3 | [764.3, 8.8, 1249.6] | -0.182 m step | static | crack 0.18 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines -3 m |
| MINOR | seam | 2952.7 | [767, 8.9, 1251.8] | -0.085 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) on lines -3 m |
| MINOR | seam | 3083.8 | [863.6, 7.3, 1341] | -0.355 m step | static | crack 0.36 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3094.1 | [872, 7, 1347] | -0.099 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 3 m |
| MINOR | seam | 3103.8 | [881, 6.7, 1351.2] | -0.158 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3108.4 | [884.9, 6.6, 1353.6] | -0.085 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 1.5 m |
| MINOR | seam | 3112.8 | [888.7, 6.3, 1355.9] | -0.17 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3117 | [891.7, 6.2, 1359.3] | -0.147 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 3 m |
| MINOR | seam | 3120.9 | [896, 5.9, 1359.8] | -0.283 m step | static | crack 0.28 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3124.6 | [898.7, 5.8, 1362.7] | -0.224 m step | static | crack 0.22 m deep, 0.3 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 3 m |
| MINOR | seam | 3131.5 | [905.3, 5.5, 1365.4] | -0.154 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 3 m |
| MINOR | seam | 3135.2 | [908.8, 5.3, 1366.7] | -0.247 m step | static | crack 0.25 m deep, 0.2 m wide between prisms (V01.bed.bight@landing \| terrain showing) on lines 3 m |
| MINOR | seam | 3139.2 | [913.1, 5.2, 1366.6] | -0.197 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (V01.bed.green@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3152.3 | [925.3, 5, 1372] | -0.114 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.green@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3157 | [929.8, 4.9, 1373.3] | -0.111 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.green@landing \| terrain showing) on lines 3 m |
| MINOR | seam | 3161.9 | [934.6, 4.8, 1374.6] | -0.154 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.green@landing \| terrain showing) on lines 3 m |
| MINOR | unguarded-step | 3164–3180 | [943.2, 4.7, 1373.8] | 1.07 m drop | static | right edge: 1.07 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 3174–3176 | [947.1, 4.7, 1374.7] | 0.43 m gap | static | right deck edge hangs 0.43 m over the terrain with no retaining wall or parapet, over 4 m |
| MINOR | surface-mismatch | 3186 | [959.2, 5, 1375.6] | 0.3 m vs bed | rev/right+2 | rode above the bed line by 0.30 m on yearWalk.shoulders.green@landing |
| MINOR | scenery | 3192 | [964.6, 4.7, 1378.9] | 5 m from centre | static | retainingWall/wall yearWalk.retaining.green@landing within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | unguarded-step | 3204–3220 | [982.2, 5.1, 1382.7] | 0.89 m drop | static | right edge: 0.89 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 3230–3232 | [1003.8, 5.6, 1386.9] | 1.2 m drop | static | left edge: 1.2 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 3230–3232 | [1003.8, 5.6, 1386.9] | 0.59 m gap | static | left deck edge hangs 0.59 m over the terrain with no retaining wall or parapet, over 4 m |
| MINOR | seam | 3292.6 | [1063.4, 3.3, 1397.9] | -0.163 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (V01.bed.landing@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3300 | [1070.6, 3.1, 1400.3] | -0.141 m step | static | crack 0.14 m deep, 0.2 m wide between prisms (V01.bed.landing@landing \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 3309 | [1080, 3, 1400.4] | -0.082 m | fwd/right+2 | step down 0.08 m between V01.bed.landing@landing and terrain |
| MINOR | drive-lip | 3309.5 | [1080.1, 3.1, 1400.4] | 0.083 m | fwd/right+2 | step up 0.08 m between terrain and V01.bed.landing@landing |
| MINOR | seam | 3313.7 | [1084.3, 3, 1401.8] | -0.099 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.landing@landing \| terrain showing) on lines 3 m |
| MINOR | seam | 3317.9 | [1088.6, 2.9, 1400.7] | -0.097 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (V01.bed.landing@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3321.9 | [1092.5, 2.9, 1402.5] | -0.088 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.landing@landing \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 3322 | [1092.7, 3, 1401.5] | 0.089 m | fwd/right+2 | step up 0.09 m between terrain and V01.bed.landing@landing |
| MINOR | drive-lip | 3322 | [1092.6, 2.9, 1401.5] | -0.089 m | fwd/right+2 | step down 0.09 m between V01.bed.landing@landing and terrain |
| MINOR | lip | 3329.3 | [1100, 2.9, 1401.5] | 0.098 m step | static | step up 0.10 m terrain → V01.bed.landing@landing on lines 1.5, 3 m |
| MINOR | lip | 3340.7 | [1111.5, 2.9, 1403.2] | 0.085 m step | static | step up 0.09 m terrain → V01.bed.landing@landing on lines 3 m |
| MINOR | seam | 3415.1 | [1185.9, 3, 1397] | -0.087 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (V01.bed.landing@landing \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3442 | [1212.6, 3.3, 1394.1] | -0.147 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (V01.bed.landing@reach \| terrain showing) on lines 1.5, 3 m |
| MINOR | unguarded-step | 3512–3524 | [1289.7, 7.2, 1382] | 0.86 m drop | static | right edge: 0.86 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 3515.6 | [1285.9, 6.5, 1385.7] | -0.356 m step | static | crack 0.36 m deep, 0.2 m wide between prisms (V01.bed.landing@reach \| terrain showing) on lines 3 m |
| MINOR | grade | 3518–3528 | [1287.8, 7, 1382.3] | 8.31 % max | static | 10 m over 8 % (max 8.3 % per 10 m) |
| MINOR | drive-lip | 3522.5 | [1292, 7.3, 1381.6] | 0.115 m | rev/centre | step up 0.11 m between terrain and V01.bed.landing@reach |
| MINOR | unguarded-step | 3530–3544 | [1305.4, 8.2, 1378.7] | 0.98 m drop | static | left edge: 0.98 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 3530.5 | [1300.7, 7.8, 1382.9] | -0.128 m step | static | crack 0.13 m deep, 0.2 m wide between prisms (V01.bed.landing@reach \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 3530.5 | [1300.6, 7.9, 1381.9] | 0.114 m | fwd/right+2 | step up 0.11 m between terrain and V01.bed.reach@reach |
| MINOR | unguarded-step | 3532 | [1301.5, 8, 1379.6] | 1.02 m drop | static | right edge: 1.02 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 3533.6 | [1303.8, 7.7, 1382.2] | -0.408 m step | static | crack 0.41 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MINOR | unguarded-step | 3536–3542 | [1305.4, 8.2, 1378.7] | 1.15 m drop | static | right edge: 1.15 m step off at 4.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 3536–3544 | [1313, 8.7, 1376.2] | 0.62 m gap | static | right deck edge hangs 0.62 m over the terrain with no retaining wall or parapet, over 10 m |
| MINOR | grade | 3536–3546 | [1305.4, 8.2, 1378.7] | 8.02 % max | static | 10 m over 8 % (max 8 % per 10 m) |
| MINOR | seam | 3549–3549.1 | [1318.9, 8.6, 1377.1] | -0.365 m step | static | crack 0.37 m deep, 0.3 m wide between prisms (quayBridge.deck@reach \| S3.surface.2.reach@reach showing) on lines 3, 1.5 m |
| MINOR | unguarded-step | 3642–3664 | [1368.1, 9.1, 1277.1] | 0.91 m drop | static | right edge: 0.91 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 3646–3660 | [1367.4, 9.1, 1281.1] | 0.82 m drop | static | left edge: 0.82 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 3666 | [1368.4, 9.1, 1275.1] | 0.67 m gap | static | right deck edge hangs 0.67 m over the terrain with no retaining wall or parapet, over 2 m |
| MINOR | unguarded-step | 3674 | [1369.4, 9.4, 1267.2] | 1.04 m drop | static | right edge: 1.04 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | junction-lip | 3681 | [1373.1, 9.7, 1256.7] | -0.273 m step | static (2×) | junction cross.v01.townRiverLink.1 (V01 × town.riverLink): 2 lips > 0.08 m; worst on road+3 at 3.5 m: crack 0.27 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) |
| MINOR | seam | 3681.2 | [1373, 9.5, 1260.2] | -0.205 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MINOR | seam | 3684.5 | [1373.1, 9.7, 1256.7] | -0.273 m step | static | crack 0.27 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3688.2 | [1372.9, 9.8, 1252.9] | -0.379 m step | static | crack 0.38 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MINOR | unguarded-step | 3690–3692 | [1369.8, 10.3, 1251.2] | 0.69 m drop | static | left edge: 0.69 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 3692.3 | [1372.6, 10.1, 1248.7] | -0.344 m step | static | crack 0.34 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MINOR | seam | 3696.8 | [1372.2, 10.5, 1244.1] | -0.199 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MINOR | seam | 3701.5 | [1371.6, 10.7, 1239.4] | -0.259 m step | static | crack 0.26 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MINOR | grade | 3706–3718 | [1368, 11.1, 1235.3] | 8.11 % max | static | 12 m over 8 % (max 8.1 % per 10 m) |
| MINOR | seam | 3709.1 | [1370.5, 11.2, 1231.8] | -0.231 m step | static | crack 0.23 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 3 m |
| MINOR | seam | 3714.4 | [1368.2, 11.4, 1226.8] | -0.454 m step | static | crack 0.45 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3717.1 | [1367.8, 11.6, 1224.1] | -0.461 m step | static | crack 0.46 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 3744.9 | [1359.1, 13.7, 1197.3] | -0.312 m step | static | crack 0.31 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines -3 m |
| MINOR | grade | 3748–3762 | [1361.3, 14.3, 1191.8] | 8.49 % max | static | 14 m over 8 % (max 8.5 % per 10 m) |
| MINOR | seam | 3753 | [1358, 14.3, 1189.2] | -0.255 m step | static | crack 0.26 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on lines -3 m |
| MINOR | seam | 3758.2 | [1357.4, 14.6, 1184] | -0.411 m step | static | crack 0.41 m deep, 0.2 m wide between prisms (V01.bed.notch@reach \| terrain showing) on lines -3 m |
| MINOR | seam | 3760.7 | [1357.2, 14.9, 1181.5] | -0.405 m step | static | crack 0.41 m deep, 0.2 m wide between prisms (V01.bed.notch@reach \| terrain showing) on lines -3 m |
| MINOR | seam | 3765.6 | [1358.3, 15.3, 1176.4] | -0.224 m step | static | crack 0.22 m deep, 0.2 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 3770.2 | [1356.5, 15.6, 1171.8] | -0.112 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 3774.4 | [1356.5, 15.8, 1167.5] | -0.224 m step | static | crack 0.22 m deep, 0.3 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3 m |
| MINOR | seam | 3778.3–3778.4 | [1358.1, 15.9, 1163.4] | -0.331 m step | static | crack 0.33 m deep, 0.2 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 3781.9 | [1358.5, 16.1, 1159.8] | -0.383 m step | static | crack 0.38 m deep, 0.3 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 3785.4 | [1359.2, 16.5, 1156.3] | -0.239 m step | static | crack 0.24 m deep, 0.2 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3, -1.5 m |
| MINOR | unguarded-step | 3788 | [1361.3, 17.1, 1154.1] | 0.57 m drop | static | right edge: 0.57 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 3789.4 | [1358.7, 16.9, 1152] | -0.372 m step | static | crack 0.37 m deep, 0.3 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3 m |
| MINOR | unguarded-step | 3792–3796 | [1362.9, 17.8, 1148.3] | 0.62 m drop | static | right edge: 0.62 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 3794–3796 | [1363.5, 18, 1146.4] | 0.76 m drop | static | left edge: 0.76 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 3804.1 | [1364.7, 18.8, 1138.2] | -0.213 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (V01.bed.notch@harbour \| terrain showing) on lines -3, -1.5 m |
| MINOR | unguarded-step | 3832 | [1376.5, 20, 1112.8] | 0.68 m drop | static | right edge: 0.68 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 3834–3840 | [1378.8, 20.4, 1107.3] | 0.94 m drop | static | left edge: 0.94 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 3842.9 | [1378, 20.2, 1101.6] | -0.495 m step | static | crack 0.49 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| terrain showing) on lines -3, -1.5 m |
| MINOR | grade | 3858–3868 | [1386.9, 21.8, 1089] | 8.13 % max | static | 10 m over 8 % (max 8.1 % per 10 m) |
| MINOR | grade | 3866–3884 | [1392.7, 22.9, 1076.3] | 11.2 % max | static | 18 m over 8 % (max 11.2 % per 10 m) |
| MINOR | unguarded-step | 3870 | [1391.9, 22.8, 1078.1] | 0.63 m drop | static | right edge: 0.63 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | lip | 3878.9 | [1392.9, 23.7, 1068.8] | 0.09 m step | static | step up 0.09 m V01.bed.harbour@harbour → VG.shoulders.harbour@harbour on lines -3 m |
| MINOR | drive-lip | 3879.5 | [1393.5, 23.7, 1068.5] | -0.109 m | rev/right+2 | step down 0.11 m between VG.shoulders.harbour@harbour and V01.bed.harbour@harbour |
| MINOR | drive-lip | 3880.5 | [1393.9, 23.9, 1067.6] | 0.087 m | rev/right+2 | step up 0.09 m between V01.bed.harbour@harbour and VG.shoulders.harbour@harbour |
| MINOR | slow-corner | 3885–5 | [1398, 24, 1064.6] | 6.3 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 6.3 m, driver down to 5.0 m/s (cornerSpeed 8) |

## VG — 8 m bed, 1180.3 m

Drives: **fwd/centre** 1179 m in 76.5 s sim (mean 15.41 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 1179 m in 76.3 s sim (mean 15.41 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 1179 m in 76.5 s sim (mean 15.41 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/right+2** 1179 m in 76.6 s sim (mean 15.42 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | seam | 112–112.8 | [1295.8, 22.9, 1101.3] | -0.813 m step | static | crack 0.81 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5, 0, 1.5, 3 m |
| MAJOR | transition | 112.5 | [1295.8, 22.9, 1101.3] | -0.813 m step | static | structure.highSpan start: structure bed 24 vs road bed 23.73 (Δ 0.27 m, plan offset 0.22 m); 6 lips > 0.08 m within ±15 m, worst on line -3 m at -0.5 m: crack 0.81 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) |
| MAJOR | drive-lip | 112.5 | [1294.5, 24, 1098.5] | 0.254 m | fwd/centre, fwd/right+2 (2×) | step up 0.25 m between VG.bed.notch@notch and highSpan.deck@notch |
| MAJOR | drive-lip | 113 | [1294.5, 23.8, 1098.5] | -0.248 m | rev/centre, rev/right+2 (2×) | step down 0.25 m between highSpan.deck@notch and VG.bed.notch@notch |
| MAJOR | seam | 133.9 | [1274.1, 9.4, 1105.2] | -14.59 m step | static | crack 14.59 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 139.3 | [1268.7, 8.9, 1106] | -15.15 m step | static | crack 15.15 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MAJOR | seam | 144.6 | [1263.4, 9.2, 1106.7] | -14.807 m step | static | crack 14.81 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 149.7 | [1258.3, 9.8, 1107.3] | -14.203 m step | static | crack 14.20 m deep, 0.2 m wide between prisms (highSpan.deck@notch \| terrain showing) on lines -3 m |
| MAJOR | seam | 154.6 | [1253.3, 9.8, 1107.7] | -14.238 m step | static | crack 14.24 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MAJOR | seam | 159.3 | [1248.5, 9.2, 1106.5] | -14.809 m step | static | crack 14.81 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 163.7 | [1244, 9.2, 1108.1] | -14.818 m step | static | crack 14.82 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 167.7 | [1239.9, 9.2, 1108] | -14.83 m step | static | crack 14.83 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 174.4 | [1233.2, 8.6, 1106] | -15.431 m step | static | crack 15.43 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 178.3 | [1229.1, 9.9, 1107.1] | -14.083 m step | static | crack 14.08 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| highSpan.walk.bed.notch@notch showing) on lines -3, -1.5 m |
| MAJOR | seam | 182.5 | [1224.9, 9.8, 1106.7] | -14.243 m step | static | crack 14.24 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MAJOR | seam | 187 | [1220.4, 10.7, 1106.1] | -13.284 m step | static | crack 13.28 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MAJOR | seam | 191.8 | [1215.7, 10.9, 1105.5] | -13.098 m step | static | crack 13.10 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MAJOR | seam | 196.8 | [1210.7, 10.6, 1104.8] | -13.44 m step | static | crack 13.44 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MAJOR | seam | 202 | [1205.5, 12.1, 1104] | -11.873 m step | static | crack 11.87 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| S1.surface.11.notch@notch showing) on lines -3 m |
| MAJOR | transition | 222.5 | [1184.9, 23.8, 1100.4] | -0.196 m step | static | structure.highSpan end: structure bed 24 vs road bed 23.82 (Δ 0.18 m, plan offset 0.22 m); 7 lips > 0.08 m within ±15 m, worst on line -3 m at 0.3 m: step down 0.20 m highSpan.deck@notch → VG.bed.notch@notch |
| MAJOR | drive-lip | 222.5–223 | [1185.3, 24, 1099.5] | 0.189 m | rev/centre, rev/right+2 (2×) | step up 0.19 m between VG.bed.notch@notch and highSpan.deck@notch |
| MAJOR | drive-lip | 222.5 | [1185.5, 23.8, 1097.5] | -0.187 m | fwd/centre, fwd/right+2 (2×) | step down 0.19 m between highSpan.deck@notch and VG.bed.notch@notch |
| MAJOR | lip | 222.8 | [1184.9, 23.8, 1100.4] | -0.196 m step | static | step down 0.20 m highSpan.deck@notch → VG.bed.notch@notch on lines -3, -1.5, 0, 1.5, 3 m |
| MAJOR | lip | 620.5 | [958.8, 31.7, 821.7] | -0.255 m step | static | step down 0.26 m yearWalk.shoulders.lakeside@lakeside → VG.bed.lakeside@lakeside on lines -3 m |
| MAJOR | lip | 624 | [959.1, 32.2, 818.2] | 0.178 m step | static | step up 0.18 m VG.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside on lines -3 m |
| MAJOR | lip | 658.2–658.8 | [963.6, 34.9, 783.6] | 0.157 m step | static | step up 0.16 m VG.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside on lines -3 m |
| MAJOR | lip | 708.7 | [971.3, 39, 734.2] | -0.191 m step | static | step down 0.19 m yearWalk.shoulders.lakeside@hollow → VG.bed.lakeside@hollow on lines -3 m |
| MAJOR | lip | 741.9 | [978.2, 42, 701.7] | 0.168 m step | static | step up 0.17 m VG.bed.lakeside@hollow → spur cottage.bed.hollow@hollow on lines -1.5 m |
| MAJOR | drive-lip | 814.5–819.5 | [1000.9, 39.5, 627] | 0.151 m | fwd/right+2 (2×) | step up 0.15 m between terrain and VG.bed.hollow@hollow |
| MAJOR | junction-lip | 836 | [997.6, 38.5, 606.8] | -0.236 m step | static (5×) | junction cross.vG.yearWalk.1 (VG × yearWalk): 5 lips > 0.08 m; worst on road-3 at 3.8 m: step down 0.24 m yearWalk.shoulders.hollow@hollow → VG.bed.hollow@hollow |
| MAJOR | lip | 839.8–840.2 | [997.6, 38.5, 606.8] | -0.236 m step | static | step down 0.24 m yearWalk.shoulders.hollow@hollow → VG.bed.hollow@hollow on lines -3, -1.5 m |
| MAJOR | drive-lip | 840.5 | [998.7, 38.7, 606.4] | 0.208 m | rev/right+2 | step up 0.21 m between VG.bed.hollow@hollow and yearWalk.shoulders.hollow@hollow |
| MAJOR | junction-lip | 848 | [1005.2, 37.8, 601.1] | -0.474 m step | static (7×) | junction cross.vG.yearWalk.2 (VG × yearWalk): 7 lips > 0.08 m; worst on other- at 6.03 m: step down 0.47 m VG.shoulders.hollow@hollow → yearWalk.bed.hollow@hollow |
| MAJOR | drive-lip | 873.5 | [993.2, 38, 573.4] | -0.154 m | fwd/right+2 | step down 0.15 m between VG.bed.hollow@hollow and terrain |
| MAJOR | drive-lip | 874 | [993.1, 38.2, 573.3] | 0.153 m | fwd/right+2 | step up 0.15 m between terrain and VG.bed.hollow@hollow |
| MAJOR | lip | 894.5 | [980.1, 39.2, 556.6] | 0.151 m step | static | step up 0.15 m VG.bed.hollow@hollow → yearWalk.shoulders.hollow@hollow on lines -3 m |
| MAJOR | drive-lip | 908.5–910.5 | [975.8, 40.2, 540.5] | 0.193 m | fwd/centre, rev/centre, rev/right+2 (3×) | step up 0.19 m between spur studio.bed.hollow@hollow and crossing.s4.vG.1.slab@hollow |
| MAJOR | lip | 910.9–913.2 | [975.8, 40.2, 540.5] | 0.199 m step | static | step up 0.20 m spur studio.bed.hollow@hollow → crossing.s4.vG.1.slab@hollow on lines 0, -1.5, -3, 1.5, 3 m |
| MAJOR | drive-lip | 911–912 | [975.8, 40, 540.5] | -0.192 m | rev/centre, rev/right+2 (2×) | step down 0.19 m between crossing.s4.vG.1.slab@hollow and spur studio.bed.hollow@hollow |
| MAJOR | junction-lip | 911.5 | [976, 40.2, 540] | 0.204 m step | static (6×) | junction cross.vG.spurStudio.1 (VG × spur studio): 6 lips > 0.08 m; worst on other- at 0.8 m: step up 0.20 m spur studio.bed.hollow@hollow → crossing.s4.vG.1.slab@hollow |
| MAJOR | junction-lip | 915 | [975.8, 40.2, 540.5] | 0.199 m step | static (3×) | junction cross.s4.vG.1 (VG × S4): 3 lips > 0.08 m; worst on road+0 at -4.1 m: step up 0.20 m spur studio.bed.hollow@hollow → crossing.s4.vG.1.slab@hollow |
| MAJOR | drive-lip | 981 | [947.7, 45.5, 476] | 0.263 m | fwd/centre, fwd/right+2 (2×) | step up 0.26 m between VG.bed.scholars@hollow and yearWalk.bed.scholars@hollow |
| MAJOR | drive-lip | 981 | [944.1, 45.3, 477.8] | -0.38 m | rev/centre, rev/right+2 (2×) | step down 0.38 m between yearWalk.bed.scholars@hollow and VG.bed.scholars@hollow |
| MAJOR | lip | 981.1–981.2 | [943.2, 45.7, 478.1] | 0.435 m step | static | step up 0.44 m VG.bed.scholars@hollow → yearWalk.bed.scholars@hollow on lines -3, -1.5, 0, 1.5, 3 m |
| MAJOR | junction-lip | 983.5 | [943.2, 45.7, 478.1] | 0.435 m step | static (4×) | junction cross.vG.yearWalk.3 (VG × yearWalk): 4 lips > 0.08 m; worst on road-3 at -2.4 m: step up 0.44 m VG.bed.scholars@hollow → yearWalk.bed.scholars@hollow |
| MAJOR | seam | 1147.9–1148 | [924.6, 49.2, 311.9] | -0.163 m step | static | crack 0.16 m deep, 0.4 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines 3, 1.5 m |
| MAJOR | seam | 1177.9–1178 | [899.5, 48, 293.9] | -0.175 m step | static | crack 0.18 m deep, 0.4 m wide between prisms (VG.bed.scholars@scholars \| V01.bed.scholars@scholars showing) on lines -3, -1.5 m |
| MAJOR | drive-lip | 1178 | [900.1, 48, 293.1] | -0.15 m | rev/right+2 | step down 0.15 m between VG.bed.scholars@scholars and V01.bed.scholars@scholars |
| MAJOR | junction-lip | 1180 | [899.5, 48, 293.9] | -0.175 m step | static (2×) | junction cross.vG.spurLibrary.1 (VG × spur library): 2 lips > 0.08 m; worst on road-3 at -2.1 m: crack 0.18 m deep, 0.4 m wide between prisms (VG.bed.scholars@scholars \| V01.bed.scholars@scholars showing) |
| MINOR | grade | 6–20 | [1392.7, 24, 1063.3] | 10.44 % max | static | 14 m over 8 % (max 10.4 % per 10 m) |
| MINOR | drive-lip | 9 | [1392.6, 23.8, 1065.6] | -0.113 m | rev/right+2 | step down 0.11 m between V01.shoulders.harbour@harbour and VG.bed.harbour@harbour |
| MINOR | drive-lip | 10 | [1392, 23.9, 1065.9] | 0.13 m | rev/right+2 | step up 0.13 m between VG.bed.harbour@harbour and V01.shoulders.harbour@harbour |
| MINOR | lip | 11 | [1391.3, 23.6, 1067.3] | -0.088 m step | static | step down 0.09 m V01.shoulders.harbour@harbour → VG.bed.harbour@harbour on lines -3 m |
| MINOR | unguarded-step | 20 | [1381.9, 22.8, 1068.4] | 0.63 m drop | static | right edge: 0.63 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | drive-lip | 40 | [1364.5, 22, 1078.5] | 0.106 m | rev/right+2 | step up 0.11 m between terrain and VG.bed.notch@harbour |
| MINOR | drive-lip | 40 | [1364.4, 21.9, 1078.6] | -0.107 m | rev/right+2 | step down 0.11 m between VG.bed.notch@harbour and terrain |
| MINOR | seam | 57.4 | [1348.8, 21.5, 1086.4] | -0.133 m step | static | crack 0.13 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 72.3 | [1334.7, 21.5, 1091.7] | -0.162 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 76.2 | [1330.9, 21.6, 1092.9] | -0.221 m step | static | crack 0.22 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 79.5 | [1327.6, 21.7, 1093.8] | -0.289 m step | static | crack 0.29 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MINOR | unguarded-step | 82–84 | [1322.5, 22.2, 1092] | 0.64 m drop | static | left edge: 0.64 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 90 | [1316.7, 22.5, 1093.5] | 0.71 m drop | static | right edge: 0.71 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 96.5 | [1311, 22.6, 1097.9] | -0.225 m step | static | crack 0.23 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | unguarded-step | 106–112 | [1297.2, 23.6, 1097.9] | 0.74 m drop | static | left edge: 0.74 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 106–110 | [1297.2, 23.6, 1097.9] | 0.67 m drop | static | right edge: 0.67 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 224–230 | [1178.4, 23.5, 1096.1] | 0.83 m drop | static | left edge: 0.83 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 224–226 | [1184.3, 23.8, 1097.2] | 0.65 m drop | static | right edge: 0.65 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 229.9 | [1178.2, 23, 1097.6] | -0.463 m step | static | crack 0.46 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MINOR | drive-lip | 235.5 | [1172.6, 23.2, 1096.9] | 0.109 m | rev/right+2 | step up 0.11 m between terrain and VG.bed.notch@notch |
| MINOR | drive-lip | 236 | [1172.5, 23.1, 1096.9] | -0.11 m | rev/right+2 | step down 0.11 m between VG.bed.notch@notch and terrain |
| MINOR | seam | 258.1 | [1150.3, 21.9, 1092.8] | -0.209 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 263.4 | [1145.1, 21.7, 1091.5] | -0.163 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 273.5 | [1135.3, 21.1, 1088.7] | -0.196 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 278.2 | [1130.7, 20.8, 1087.2] | -0.206 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 282.7 | [1126.4, 20.6, 1085.7] | -0.208 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 286.8 | [1122.5, 20.3, 1084.3] | -0.201 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 290.7 | [1118.8, 20, 1082.7] | -0.273 m step | static | crack 0.27 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 294 | [1115.7, 19.8, 1081.4] | -0.325 m step | static | crack 0.33 m deep, 0.2 m wide between prisms (VG.bed.green@notch \| terrain showing) on lines -3 m |
| MINOR | seam | 306.1 | [1105.4, 19.3, 1074.7] | -0.193 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 310.7 | [1100.6, 19.1, 1073.9] | -0.183 m step | static | crack 0.18 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3, -1.5 m |
| MINOR | drive-lip | 320.5 | [1092.4, 19, 1068.4] | 0.149 m | rev/right+2 | step up 0.15 m between terrain and VG.bed.green@green |
| MINOR | drive-lip | 321 | [1092.3, 18.9, 1068.3] | -0.15 m | rev/right+2 | step down 0.15 m between VG.bed.green@green and terrain |
| MINOR | drive-lip | 331.5 | [1083, 18.9, 1063.2] | 0.1 m | rev/right+2 | step up 0.10 m between terrain and VG.bed.green@green |
| MINOR | drive-lip | 331.5 | [1082.8, 18.8, 1063.1] | -0.101 m | rev/right+2 | step down 0.10 m between VG.bed.green@green and terrain |
| MINOR | seam | 342.7 | [1072.5, 18.7, 1058.3] | -0.083 m step | static | crack 0.08 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3 m |
| MINOR | lip | 348.6 | [1067.4, 18.8, 1055.3] | 0.098 m step | static | step up 0.10 m terrain → VG.bed.green@green on lines -3, -1.5 m |
| MINOR | drive-lip | 354.5 | [1063.1, 18.8, 1051.5] | 0.083 m | rev/right+2 | step up 0.08 m between terrain and VG.bed.green@green |
| MINOR | drive-lip | 354.5 | [1063, 18.8, 1051.4] | -0.083 m | rev/right+2 | step down 0.08 m between VG.bed.green@green and terrain |
| MINOR | seam | 383.7 | [1037.7, 19.1, 1036.2] | -0.11 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3 m |
| MINOR | seam | 389.4 | [1033.9, 19.2, 1031.7] | -0.136 m step | static | crack 0.14 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 395 | [1028.4, 19.3, 1029.7] | -0.125 m step | static | crack 0.13 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3 m |
| MINOR | seam | 400.4 | [1024.9, 19.4, 1025.2] | -0.191 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3, -1.5 m |
| MINOR | drive-lip | 405.5 | [1020.5, 19.8, 1022.5] | 0.12 m | rev/right+2 | step up 0.12 m between terrain and VG.bed.green@green |
| MINOR | drive-lip | 406 | [1020.4, 19.6, 1022.4] | -0.119 m | rev/right+2 | step down 0.12 m between VG.bed.green@green and terrain |
| MINOR | seam | 410.7 | [1015.8, 19.7, 1020] | -0.202 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3 m |
| MINOR | seam | 415.6 | [1012, 20, 1016.8] | -0.157 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3 m |
| MINOR | seam | 420.2 | [1009.6, 20.2, 1012.5] | -0.184 m step | static | crack 0.18 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 424.5 | [1006.4, 20.3, 1009.5] | -0.282 m step | static | crack 0.28 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 428.6 | [1002.4, 20.6, 1007.6] | -0.194 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 432.3 | [1001, 20.8, 1003.7] | -0.154 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -1.5 m |
| MINOR | seam | 435.8 | [998.8, 21, 1000.9] | -0.24 m step | static | crack 0.24 m deep, 0.2 m wide between prisms (VG.bed.green@green \| terrain showing) on lines -1.5 m |
| MINOR | drive-lip | 466 | [984.6, 23.1, 973.7] | 0.093 m | rev/right+2 | step up 0.09 m between VG.bed.green@green and yearWalk.shoulders.green@green |
| MINOR | lip | 479.9 | [979, 23.9, 960.9] | 0.093 m step | static | step up 0.09 m yearWalk.shoulders.green@green → VG.bed.green@green on lines -3 m |
| MINOR | drive-lip | 485 | [978.3, 24.2, 955.7] | 0.135 m | rev/right+2 | step up 0.13 m between terrain and VG.bed.green@green |
| MINOR | drive-lip | 485.5 | [978.3, 24, 955.6] | -0.133 m | rev/right+2 | step down 0.13 m between VG.bed.green@green and terrain |
| MINOR | seam | 566.2–566.3 | [960.3, 28.7, 876.3] | -0.316 m step | static | crack 0.32 m deep, 0.2 m wide between prisms (VG.bed.lakeside@lakeside \| terrain showing) on lines -1.5, -3 m |
| MINOR | junction-lip | 578 | [960.2, 29.9, 862.6] | 0.084 m step | static (2×) | junction cross.vG.walkBight.1 (VG × walk bight): 2 lips > 0.08 m; worst on road+0 at 1.8 m: step up 0.08 m VG.bed.lakeside@lakeside → VBS.bed.lakeside@lakeside |
| MINOR | drive-lip | 579.5–580.5 | [962.1, 30, 861.4] | 0.102 m | fwd/centre, fwd/right+2 (2×) | step up 0.10 m between VG.bed.lakeside@lakeside and spur glasshouse.bed.lakeside@lakeside |
| MINOR | lip | 579.8–581.4 | [961.7, 30, 861.8] | 0.118 m step | static | step up 0.12 m VG.bed.lakeside@lakeside → spur glasshouse.bed.lakeside@lakeside on lines 0, 1.5, 3 m |
| MINOR | drive-lip | 580 | [960.2, 29.8, 862.7] | -0.08 m | rev/centre | step down 0.08 m between VBS.bed.lakeside@lakeside and VG.bed.lakeside@lakeside |
| MINOR | unguarded-step | 582 | [960, 30, 860.4] | 0.58 m drop | static | right edge: 0.58 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | junction-lip | 582.5 | [960.2, 29.9, 862.6] | 0.084 m step | static (2×) | junction cross.vG.spurGlasshouse.1 (VG × spur glasshouse): 2 lips > 0.08 m; worst on road+0 at -2.7 m: step up 0.08 m VG.bed.lakeside@lakeside → VBS.bed.lakeside@lakeside |
| MINOR | junction-lip | 582.5 | [960.2, 29.9, 862.6] | 0.084 m step | static (2×) | junction cross.vBS.vG.1 (VG × VBS): 2 lips > 0.08 m; worst on road+0 at -2.7 m: step up 0.08 m VG.bed.lakeside@lakeside → VBS.bed.lakeside@lakeside |
| MINOR | drive-lip | 593.5 | [957.8, 30.1, 849] | -0.098 m | rev/right+2 | step down 0.10 m between VG.bed.lakeside@lakeside and terrain |
| MINOR | drive-lip | 593.5 | [957.8, 30.2, 849.1] | 0.098 m | rev/right+2 | step up 0.10 m between terrain and VG.bed.lakeside@lakeside |
| MINOR | drive-lip | 597.5–602 | [958, 30.3, 844.8] | -0.093 m | rev/right+2 (2×) | step down 0.09 m between VG.bed.lakeside@lakeside and terrain |
| MINOR | drive-lip | 597.5–602 | [958, 30.4, 844.9] | 0.093 m | rev/right+2 (2×) | step up 0.09 m between terrain and VG.bed.lakeside@lakeside |
| MINOR | lip | 611.7 | [959.4, 31.1, 830.6] | 0.097 m step | static | step up 0.10 m terrain → VG.bed.lakeside@lakeside on lines -1.5 m |
| MINOR | lip | 616.8 | [959.9, 31.5, 825.5] | 0.087 m step | static | step up 0.09 m terrain → VG.bed.lakeside@lakeside on lines -1.5 m |
| MINOR | grade | 636–744 | [969.7, 36.5, 763.1] | 8.55 % max | static | 108 m over 8 % (max 8.6 % per 10 m) |
| MINOR | scenery | 674 | [968.8, 36, 769] | 5 m from centre | static | pier/support gardenWalkBridge.supports@lakeside within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | lip | 712.1 | [971.9, 39.4, 730.9] | 0.109 m step | static | step up 0.11 m VG.bed.lakeside@hollow → yearWalk.shoulders.lakeside@hollow on lines -3 m |
| MINOR | floating-edge | 742–744 | [980, 42, 699.9] | 0.47 m gap | static | left deck edge hangs 0.47 m over the terrain with no retaining wall or parapet, over 4 m |
| MINOR | drive-lip | 742.5–747 | [977.7, 41.9, 701.3] | -0.11 m | fwd/centre, rev/right+2 (2×) | step down 0.11 m between spur cottage.bed.hollow@hollow and VG.bed.lakeside@hollow |
| MINOR | junction-lip | 744 | [980.5, 41.9, 696.9] | -0.09 m step | static (2×) | junction cross.vG.spurCottage.1 (VG × spur cottage): 2 lips > 0.08 m; worst on road+0 at 3 m: step down 0.09 m spur cottage.bed.hollow@hollow → VG.bed.hollow@hollow |
| MINOR | lip | 747 | [980.5, 41.9, 696.9] | -0.09 m step | static | step down 0.09 m spur cottage.bed.hollow@hollow → VG.bed.hollow@hollow on lines 0 m |
| MINOR | drive-lip | 747 | [980.5, 42, 697.1] | 0.085 m | rev/centre | step up 0.08 m between VG.bed.hollow@hollow and spur cottage.bed.hollow@hollow |
| MINOR | lip | 748 | [979.2, 41.8, 695.7] | -0.089 m step | static | step down 0.09 m spur cottage.bed.hollow@hollow → VG.bed.hollow@hollow on lines -1.5 m |
| MINOR | lip | 749 | [978, 41.8, 694.4] | -0.083 m step | static | step down 0.08 m spur cottage.bed.hollow@hollow → VG.bed.hollow@hollow on lines -3 m |
| MINOR | seam | 753 | [980.3, 41.3, 690.7] | -0.307 m step | static | crack 0.31 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines -1.5 m |
| MINOR | seam | 757.8 | [981.4, 41.1, 686] | -0.309 m step | static | crack 0.31 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines -1.5 m |
| MINOR | drive-lip | 788.5 | [993.2, 40.5, 657.3] | -0.127 m | fwd/right+2 | step down 0.13 m between VG.bed.hollow@hollow and terrain |
| MINOR | drive-lip | 788.5 | [993.3, 40.7, 657.2] | 0.128 m | fwd/right+2 | step up 0.13 m between terrain and VG.bed.hollow@hollow |
| MINOR | seam | 804.4 | [997, 40.1, 641.9] | -0.111 m step | static | crack 0.11 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 804.5–809.5 | [998.7, 39.8, 637.1] | -0.119 m | fwd/right+2 (2×) | step down 0.12 m between VG.bed.hollow@hollow and terrain |
| MINOR | drive-lip | 804.5–809.5 | [998.8, 40, 636.9] | 0.121 m | fwd/right+2 (2×) | step up 0.12 m between terrain and VG.bed.hollow@hollow |
| MINOR | drive-lip | 814.5–819.5 | [1000.9, 39.4, 627.1] | -0.148 m | fwd/right+2 (2×) | step down 0.15 m between VG.bed.hollow@hollow and terrain |
| MINOR | seam | 814.6 | [1000.9, 39.6, 632.3] | -0.162 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 819.6 | [1001.9, 39.3, 627.3] | -0.203 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 3 m |
| MINOR | seam | 824.4 | [1002.6, 39, 622.4] | -0.257 m step | static | crack 0.26 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 829.1 | [1003.2, 38.8, 617.6] | -0.259 m step | static | crack 0.26 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | unguarded-step | 830 | [1000.3, 39, 616.4] | 0.68 m drop | static | right edge: 0.68 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 833.6–833.7 | [1002.1, 38.6, 612.8] | -0.226 m step | static | crack 0.23 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| yearWalk.bed.hollow@hollow showing) on lines 3, 1.5 m |
| MINOR | seam | 838 | [1003.7, 38.1, 608.4] | -0.52 m step | static | crack 0.52 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 3 m |
| MINOR | unguarded-step | 840–844 | [1000.6, 38.5, 606.4] | 0.69 m drop | static | right edge: 0.69 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 842.3–842.4 | [1003.5, 37.9, 603.9] | -0.48 m step | static | crack 0.48 m deep, 0.3 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 3, 1.5 m |
| MINOR | seam | 846.4–846.5 | [1001.5, 37.8, 599.7] | -0.459 m step | static | crack 0.46 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| yearWalk.bed.hollow@hollow showing) on lines 3, 1.5 m |
| MINOR | seam | 849.4 | [1000.9, 37.7, 596.8] | -0.352 m step | static | crack 0.35 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| yearWalk.bed.hollow@hollow showing) on lines 1.5, 3 m |
| MINOR | seam | 852.7 | [1001.5, 37.6, 593.1] | -0.339 m step | static | crack 0.34 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 856.3 | [1000.4, 37.6, 589.6] | -0.322 m step | static | crack 0.32 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 864.5 | [996.2, 37.8, 582.2] | -0.214 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 869 | [995.9, 37.8, 577.5] | -0.24 m step | static | crack 0.24 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 3 m |
| MINOR | seam | 873.8 | [994, 38, 573] | -0.173 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 878.8 | [992, 38.3, 568.4] | -0.093 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 884 | [989.9, 38.5, 563.6] | -0.1 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 896.5 | [979.2, 39.2, 554.8] | -0.121 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (yearWalk.shoulders.hollow@hollow \| VG.bed.hollow@hollow showing) on lines -3 m |
| MINOR | seam | 900.5 | [977.5, 39.4, 551.1] | -0.099 m step | static | crack 0.10 m deep, 0.2 m wide between prisms (yearWalk.shoulders.hollow@hollow \| VG.bed.hollow@hollow showing) on lines -3 m |
| MINOR | lip | 907.3–909.4 | [975.1, 40, 542.5] | 0.116 m step | static | step up 0.12 m VG.bed.hollow@hollow → spur studio.bed.hollow@hollow on lines 3, 1.5, 0, -1.5 m |
| MINOR | drive-lip | 907.5–913 | [976.6, 40.2, 537.6] | 0.123 m | fwd/centre, fwd/right+2 (3×) | step up 0.12 m between VG.bed.hollow@hollow and S4.surface.0.hollow@hollow |
| MINOR | grade | 948–984 | [949.5, 44.5, 485.3] | 10.55 % max | static | 36 m over 8 % (max 10.5 % per 10 m) |
| MINOR | buried | 974–976 | [951.9, 44.8, 482.1] | 0.127 m terrain above deck | static | visible terrain 0.127 m above the deck inside the carriageway over 4 m |
| MINOR | scenery | 980 | [946.4, 45.2, 477.9] | 5 m from centre | static | retainingWall/wall yearWalk.retaining.hollow@hollow within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | surface-mismatch | 981.5–982 | [944, 45.7, 477.7] | 0.35 m vs bed | rev/right+2 | rode above the bed line by 0.35 m on yearWalk.bed.scholars@hollow |
| MINOR | seam | 988.1 | [940.6, 45.6, 471.5] | -0.155 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (VG.bed.scholars@hollow \| yearWalk.shoulders.scholars@hollow showing) on lines -3 m |
| MINOR | seam | 992.1 | [939.2, 45.8, 467.6] | -0.162 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (VG.bed.scholars@hollow \| yearWalk.shoulders.scholars@hollow showing) on lines -3 m |
| MINOR | seam | 995.7 | [939.5, 46, 463.7] | -0.118 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (VG.bed.scholars@hollow \| terrain showing) on lines -3, -1.5 m |
| MINOR | drive-lip | 1026 | [934, 47.9, 433.5] | 0.129 m | rev/right+2 | step up 0.13 m between terrain and VG.bed.scholars@hollow |
| MINOR | seam | 1026.2 | [934.5, 47.8, 433.3] | -0.123 m step | static | crack 0.12 m deep, 0.2 m wide between prisms (VG.bed.scholars@hollow \| terrain showing) on lines -1.5 m |
| MINOR | drive-lip | 1026.5 | [934, 47.8, 433.4] | -0.128 m | rev/right+2 | step down 0.13 m between VG.bed.scholars@hollow and terrain |
| MINOR | lip | 1108.8 | [935.2, 50.9, 350.5] | 0.086 m step | static | step up 0.09 m terrain → VG.bed.scholars@scholars on lines 1.5, 3 m |
| MINOR | seam | 1124.2 | [932.4, 50.2, 335.1] | -0.197 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1127.1 | [932, 50.1, 332.2] | -0.188 m step | static | crack 0.19 m deep, 0.2 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 1129.5 | [931.8, 50.1, 329.4] | 0.088 m | fwd/right+2 | step up 0.09 m between terrain and VG.bed.scholars@scholars |
| MINOR | lip | 1129.7–1129.8 | [931.4, 50.1, 329.5] | 0.101 m step | static | step up 0.10 m terrain → VG.bed.scholars@scholars on lines 1.5, 3 m |
| MINOR | drive-lip | 1135.5 | [930, 49.7, 323.5] | -0.136 m | fwd/right+2 | step down 0.14 m between VG.bed.scholars@scholars and terrain |
| MINOR | seam | 1135.6–1135.7 | [929.5, 49.7, 323.7] | -0.146 m step | static | crack 0.15 m deep, 0.3 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines 3, 1.5 m |
| MINOR | drive-lip | 1136 | [929.8, 49.9, 323.2] | 0.148 m | fwd/right+2 | step up 0.15 m between terrain and VG.bed.scholars@scholars |
| MINOR | seam | 1154 | [920.8, 49.1, 306.8] | -0.096 m step | static | crack 0.10 m deep, 0.3 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines 3 m |
| MINOR | drive-lip | 1154–1160 | [916, 48.9, 302.8] | 0.123 m | fwd/right+2 (2×) | step up 0.12 m between terrain and VG.bed.scholars@scholars |
| MINOR | drive-lip | 1154–1160 | [916.1, 48.8, 302.9] | -0.119 m | fwd/right+2 (2×) | step down 0.12 m between VG.bed.scholars@scholars and terrain |
| MINOR | seam | 1159.9 | [915.7, 48.8, 303.3] | -0.127 m step | static | crack 0.13 m deep, 0.2 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | seam | 1165.4 | [911.8, 48.6, 299.3] | -0.145 m step | static | crack 0.15 m deep, 0.2 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines 1.5, 3 m |
| MINOR | drive-lip | 1170.5 | [908.5, 48.5, 295.4] | 0.104 m | fwd/right+2 | step up 0.10 m between terrain and VG.bed.scholars@scholars |
| MINOR | drive-lip | 1170.5 | [908.6, 48.4, 295.5] | -0.102 m | fwd/right+2 | step down 0.10 m between VG.bed.scholars@scholars and terrain |
| MINOR | seam | 1174.6 | [902, 48.1, 296.3] | -0.262 m step | static | crack 0.26 m deep, 0.2 m wide between prisms (VG.bed.scholars@scholars \| terrain showing) on lines -3 m |
| MINOR | drive-lip | 1178 | [900.2, 48.1, 293.2] | 0.145 m | rev/right+2 | step up 0.15 m between V01.bed.scholars@scholars and VG.bed.scholars@scholars |

## VBS — 5 m bed, 334.3 m

Drives: **fwd/centre** 333 m in 23.3 s sim (mean 14.27 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 333 m in 23.3 s sim (mean 14.28 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | junction-lip | 6.5 | [948.3, 29.1, 861.3] | -0.871 m step | static (2×) | junction cross.vBS.yearWalk.1 (VBS × yearWalk): 2 lips > 0.08 m; worst on road+3 at 4.9 m: step down 0.87 m yearWalk.bed.lakeside@lakeside → terrain |
| BLOCKER | junction-lip | 9.5 | [948.3, 29.1, 861.3] | -0.871 m step | static (3×) | junction cross.vBS.yearWalk.2 (VBS × yearWalk): 3 lips > 0.08 m; worst on road+3 at 1.9 m: step down 0.87 m yearWalk.bed.lakeside@lakeside → terrain |
| BLOCKER | junction-lip | 136 | [864.6, 20.2, 952.1] | -0.579 m step | static (4×) | junction cross.vBS.plotBight1Service.1 (VBS × plot.bight.1.service): 4 lips > 0.08 m; worst on road+3 at 3.2 m: step down 0.58 m plot.bight.1.layby.slab@bight → terrain |
| BLOCKER | junction-lip | 163.5 | [850.5, 19.5, 976.3] | -0.596 m step | static (4×) | junction cross.vBS.yearWalk.5 (VBS × yearWalk): 4 lips > 0.08 m; worst on road+3 at 3.7 m: step down 0.60 m yearWalk.shoulders.bight@bight → terrain |
| MAJOR | grade | 8–42 | [948.8, 29.6, 864.3] | 12.03 % max | static | 34 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum |
| MAJOR | seam | 11.7–13.4 | [947.6, 29.8, 863.8] | 0.271 m step | static | ridge 0.27 m high, 0.4 m wide between prisms (VBS.bed.lakeside@lakeside \| yearWalk.shoulders.lakeside@lakeside showing) on lines 1.88, 0.94, -0.94, -1.87, 0 m |
| MAJOR | drive-lip | 13.5 | [947.4, 29.5, 864.9] | -0.266 m | fwd/centre | step down 0.27 m between yearWalk.shoulders.lakeside@lakeside and VBS.bed.lakeside@lakeside |
| MAJOR | drive-lip | 13.5 | [947.5, 29.8, 864.8] | 0.268 m | rev/centre | step up 0.27 m between VBS.bed.lakeside@lakeside and yearWalk.shoulders.lakeside@lakeside |
| MAJOR | obstruction | 32–62 | [930.2, 27.7, 871.6] | 2.25 m from centre | static | parapet/rail VBS.edges.lakeside@lakeside inside the carriageway at 2.25 m from centre |
| MAJOR | transition | 37 | [915, 19.1, 876.8] | -7.414 m step | static | structure.bightSpurTrestle start: structure bed 27.22 vs road bed 27.29 (Δ -0.06 m, plan offset 0.17 m); 6 lips > 0.08 m within ±15 m, worst on line 1.5 m at 10.9 m: crack 7.41 m deep, 0.2 m wide between prisms (VBS.bed.lakeside@bight \| terrain showing) |
| MAJOR | seam | 42.5 | [919.8, 23.4, 874.1] | -3.454 m step | static | crack 3.45 m deep, 0.2 m wide between prisms (VBS.bed.lakeside@bight \| terrain showing) on lines 1.88 m |
| MAJOR | seam | 47.9 | [914.8, 18.6, 876.5] | -7.917 m step | static | crack 7.92 m deep, 0.2 m wide between prisms (VBS.bed.lakeside@bight \| terrain showing) on lines 0.94, 1.88 m |
| MAJOR | seam | 52.8 | [910.5, 17.3, 878.9] | -8.842 m step | static | crack 8.84 m deep, 0.2 m wide between prisms (VBS.bed.lakeside@bight \| terrain showing) on lines 0.94, 1.88 m |
| MAJOR | seam | 57–57.1 | [906.8, 17.3, 881.2] | -8.511 m step | static | crack 8.51 m deep, 0.3 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 1.88, 0.94 m |
| MAJOR | seam | 60.5–60.6 | [903.8, 17.6, 883.5] | -7.959 m step | static | crack 7.96 m deep, 0.4 m wide between prisms (VBS.bed.bight@bight \| yearWalk.bed.bight@bight showing) on lines 1.88, 0.94 m |
| MAJOR | missing-guard | 64 | [902.7, 25.3, 887.5] | 7.73 m drop | static | right edge: 7.73 m drop at 1.75 m from centre with no guard (onto yearWalk.bed.bight@bight, on bightSpurTrestle.deck@bight) over 2 m |
| MAJOR | seam | 64–64.1 | [901.3, 17.6, 886.3] | -7.685 m step | static | crack 7.68 m deep, 0.3 m wide between prisms (VBS.bed.bight@bight \| yearWalk.bed.bight@bight showing) on lines 1.88, 0.94 m |
| MAJOR | obstruction | 66–114 | [901.5, 25.1, 889.1] | 2.25 m from centre | static | parapet/rail VBS.edges.bight@bight inside the carriageway at 2.25 m from centre |
| MAJOR | seam | 68.1 | [899.5, 17.4, 890.2] | -7.607 m step | static | crack 7.61 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 0.94, 1.88 m |
| MAJOR | seam | 72.7 | [896.2, 17.6, 893.7] | -6.987 m step | static | crack 6.99 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 1.88 m |
| MAJOR | seam | 77.6 | [893.7, 17.9, 898] | -6.354 m step | static | crack 6.35 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 1.88 m |
| MAJOR | seam | 82.9 | [892, 18.1, 903.1] | -5.719 m step | static | crack 5.72 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 0.94, 1.88 m |
| MAJOR | seam | 88.4 | [889.5, 18.2, 908.1] | -5.147 m step | static | crack 5.15 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 0.94, 1.88 m |
| MAJOR | transition | 110.5 | [872.4, 21.3, 938.6] | 0.176 m step | static | structure.bightSpurTrestle end: structure bed 21.98 vs road bed 21.9 (Δ 0.07 m, plan offset 0.22 m); 2 lips > 0.08 m within ±15 m, worst on line 3 m at 13 m: step up 0.18 m terrain → crossing.s4.vBS.1.slab@bight |
| MAJOR | junction-lip | 130 | [869.1, 20.9, 944.3] | -0.206 m step | static (4×) | junction cross.s4.vBS.1 (VBS × S4): 4 lips > 0.08 m; worst on road+3 at 0.1 m: step down 0.21 m S4.surface.1.bight@bight → terrain |
| MAJOR | lip | 167.2–167.3 | [851.5, 19.8, 976.9] | -0.189 m step | static | step down 0.19 m yearWalk.shoulders.bight@bight → VBS.bed.bight@bight on lines 0.94, 1.88, -1.87, -0.94, 0 m |
| MAJOR | junction-lip | 207 | [828.5, 18.5, 1012.8] | -0.223 m step | static (3×) | junction cross.vBS.plotBight2Service.1 (VBS × plot.bight.2.service): 3 lips > 0.08 m; worst on road+3 at 2.9 m: step down 0.22 m plot.bight.2.layby.slab@bight → terrain |
| MAJOR | junction-lip | 271 | [794.9, 15.6, 1068.7] | -0.384 m step | static (4×) | junction cross.vBS.plotBight3Service.1 (VBS × plot.bight.3.service): 4 lips > 0.08 m; worst on road+3 at 3.8 m: step down 0.38 m plot.bight.3.layby.slab@bight → terrain |
| MAJOR | drive-lip | 274.5 | [797.6, 15.8, 1070] | -0.21 m | fwd/centre | step down 0.21 m between plot.bight.3.layby.slab@bight and VBS.bed.bight@bight |
| MAJOR | lip | 274.7–274.8 | [798.4, 15.8, 1070.4] | -0.215 m step | static | step down 0.21 m plot.bight.3.layby.slab@bight → VBS.bed.bight@bight on lines -1.87, -0.94, 0, 0.94, 1.88 m |
| MAJOR | drive-lip | 275 | [797.6, 16, 1069.9] | 0.211 m | rev/centre | step up 0.21 m between VBS.bed.bight@bight and plot.bight.3.layby.slab@bight |
| MINOR | surface-mismatch | 5 | [955.5, 29.9, 861.8] | 0.31 m vs bed | fwd/centre, rev/centre (2×) | rode above the bed line by 0.31 m on yearWalk.bed.lakeside@lakeside |
| MINOR | surface-mismatch | 5.5–7 | [954.1, 29.9, 862.4] | 0.38 m vs bed | fwd/centre, rev/centre (2×) | rode above the bed line by 0.38 m on yearWalk.shoulders.lakeside@lakeside |
| MINOR | unguarded-step | 12 | [948.8, 29.6, 864.3] | 0.54 m drop | static | right edge: 0.54 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 14–16 | [946.9, 29.5, 865] | 0.62 m drop | static | left edge: 0.62 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | verge-drop | 26 | [935.7, 28.2, 869.3] | 1.57 m drop | static | right: 1.57 m drop 4.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 28–34 | [928.3, 27.5, 872.4] | 0.9 m drop | static | left edge: 0.9 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 30 | [932, 27.9, 870.8] | 1.21 m drop | static | right edge: 1.21 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | verge-drop | 42 | [921, 26.9, 875.6] | 1.76 m drop | static | left: 1.76 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 54–66 | [910.4, 26.1, 881.1] | 8.23 m drop | static | left: 8.23 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 70–76 | [899.3, 24.8, 892.4] | 6.83 m drop | static | left: 6.83 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 88–92 | [890.5, 23.4, 908.1] | 2.79 m drop | static | left: 2.79 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 98 | [886.2, 22.7, 917.1] | 1.35 m drop | static | left: 1.35 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 116–120 | [878.5, 21.7, 933.4] | 1.02 m drop | static | right edge: 1.02 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 119.6 | [877.7, 21.1, 937] | -0.504 m step | static | crack 0.50 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines -1.87, -0.94 m |
| MINOR | seam | 123.5 | [876.6, 21.3, 940.9] | -0.09 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| crossing.s4.vBS.1.slab@bight showing) on lines -1.87 m |
| MINOR | drive-lip | 127.5 | [873.1, 21.2, 943.5] | -0.095 m | fwd/centre | step down 0.09 m between crossing.s4.vBS.1.slab@bight and VBS.bed.bight@bight |
| MINOR | drive-lip | 127.5–133 | [870.4, 21, 948.1] | 0.106 m | rev/centre (2×) | step up 0.11 m between VBS.bed.bight@bight and S4.surface.2.bight@bight |
| MINOR | lip | 127.6–128.3 | [871, 21.2, 943.3] | -0.147 m step | static | step down 0.15 m crossing.s4.vBS.1.slab@bight → VBS.bed.bight@bight on lines 0, 0.94, 1.88 m |
| MINOR | lip | 131.2–133.7 | [869.6, 20.9, 945.8] | -0.129 m step | static | step down 0.13 m S4.surface.1.bight@bight → VBS.bed.bight@bight on lines 1.88, 0.94, 0, -0.94 m |
| MINOR | drive-lip | 133 | [870.4, 20.9, 948.2] | -0.104 m | fwd/centre | step down 0.10 m between S4.surface.2.bight@bight and VBS.bed.bight@bight |
| MINOR | lip | 140 | [868.4, 20.7, 955.3] | -0.081 m step | static | step down 0.08 m plot.bight.1.layby.slab@bight → VBS.bed.bight@bight on lines -1.87 m |
| MINOR | drive-lip | 167 | [853, 19.8, 978] | -0.14 m | fwd/centre | step down 0.14 m between yearWalk.shoulders.bight@bight and VBS.bed.bight@bight |
| MINOR | drive-lip | 167 | [853.2, 20, 977.8] | 0.138 m | rev/centre | step up 0.14 m between VBS.bed.bight@bight and yearWalk.shoulders.bight@bight |
| MINOR | unguarded-step | 170 | [851.7, 19.8, 980.3] | 0.52 m drop | static | right edge: 0.52 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | lip | 210.2–211 | [832, 18.6, 1016.3] | -0.135 m step | static | step down 0.14 m plot.bight.2.layby.slab@bight → VBS.bed.bight@bight on lines 1.88, 0.94, 0, -0.94, -1.87 m |
| MINOR | drive-lip | 210.5 | [830.7, 18.6, 1015] | -0.117 m | fwd/centre | step down 0.12 m between plot.bight.2.layby.slab@bight and VBS.bed.bight@bight |
| MINOR | drive-lip | 210.5 | [830.8, 18.7, 1014.8] | 0.113 m | rev/centre | step up 0.11 m between VBS.bed.bight@bight and plot.bight.2.layby.slab@bight |
| MINOR | seam | 257.6 | [804.1, 16.5, 1053.9] | -0.173 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 1.88 m |
| MINOR | seam | 265.9 | [800, 16.1, 1061.1] | -0.204 m step | static | crack 0.20 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 0.94, 1.88 m |
| MINOR | seam | 269.3 | [798.3, 16, 1064.2] | -0.167 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| plot.bight.3.layby.slab@bight showing) on lines 1.88 m |
| MINOR | seam | 278.4 | [794.4, 15.4, 1072.5] | -0.251 m step | static | crack 0.25 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 1.88 m |
| MINOR | seam | 314 | [781.6, 14.1, 1105.8] | -0.178 m step | static | crack 0.18 m deep, 0.2 m wide between prisms (VBS.bed.bight@bight \| terrain showing) on lines 0.94, 1.88 m |
| MINOR | junction-lip | 334 | [773.3, 14, 1121.1] | 0.094 m step | static | junction cross.vBS.plotBight4Service.1 (VBS × plot.bight.4.service): 1 lips > 0.08 m; worst on road+3 at -2.7 m: step up 0.09 m terrain → plot.bight.4.layby.slab@bight |

## V03 — 8 m bed, 327.4 m

Drives: **fwd/centre** 326 m in 22.5 s sim (mean 14.48 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 326 m in 22.5 s sim (mean 14.48 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 326 m in 22.5 s sim (mean 14.47 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/right+2** 326 m in 22.5 s sim (mean 14.48 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | buried | 246–274 | [1342.9, 55.5, 769.3] | 0.556 m terrain above deck | static | visible terrain 0.556 m above the deck inside the carriageway over 30 m (Mountain v2 ground) |
| MAJOR | floating-edge | 16–30 | [1569.5, 36.8, 790.9] | 3.14 m gap | static | left deck edge hangs 3.14 m over the terrain with no retaining wall or parapet, over 16 m |
| MAJOR | seam | 24.5 | [1575, 35.6, 792.5] | -0.778 m step | static | crack 0.78 m deep, 0.2 m wide between prisms (V03.bed.prow@prow \| terrain showing) on lines -3, -1.5 m |
| MAJOR | floating-edge | 38–60 | [1539.5, 39.2, 790.5] | 6.62 m gap | static | left deck edge hangs 6.62 m over the terrain with no retaining wall or parapet, over 24 m |
| MAJOR | missing-guard | 46 | [1553.5, 38, 790.7] | 1.49 m drop | static | right edge: 1.49 m drop at 5.25 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | floating-edge | 64–68 | [1535.5, 39.5, 790.4] | 6.01 m gap | static | left deck edge hangs 6.01 m over the terrain with no retaining wall or parapet, over 6 m |
| MAJOR | missing-guard | 72 | [1527.5, 40.3, 790.3] | 1.34 m drop | static | right edge: 1.34 m drop at 6 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | missing-guard | 76 | [1523.5, 40.7, 790.3] | 1.35 m drop | static | right edge: 1.35 m drop at 6 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | lip | 83.1 | [1516.4, 41.4, 793.1] | -0.158 m step | static | step down 0.16 m yearWalk.shoulders.lakeside@prow → V03.bed.lakeside@prow on lines -3 m |
| MAJOR | obstruction | 86 | [1513.5, 41.6, 790.1] | 3.75 m from centre | static | bed/deck yearWalk.bed.lakeside@prow inside the carriageway at 3.75 m from centre |
| MAJOR | missing-guard | 86 | [1513.5, 41.6, 790.1] | 1.29 m drop | static | right edge: 1.29 m drop at 5.75 m from centre with no guard (onto terrain) over 2 m |
| MAJOR | lip | 88.3 | [1511.2, 42, 793.1] | 0.181 m step | static | step up 0.18 m V03.bed.lakeside@prow → yearWalk.shoulders.lakeside@prow on lines -3 m |
| MAJOR | headroom | 190 | [1409.5, 51.9, 789.1] | 4.99 m clear | static | 4.99 m headroom under mountainRoadTunnel.roof@prow at 3.95 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| MAJOR | headroom | 194 | [1405.5, 52.3, 789] | 4.99 m clear | static | 4.99 m headroom under mountainRoadTunnel.roof@prow at 3.95 m from centre (profile clear 5 m; cruiser needs 1.55 m) |
| MAJOR | surface-mismatch | 250.5–269.5 | [1342.9, 55.5, 767.4] | 0.56 m vs bed | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | rode above the bed line by 0.56 m on terrain |
| MAJOR | floating-edge | 282–298 | [1309, 55.8, 752.2] | 1.22 m gap | static | left deck edge hangs 1.22 m over the terrain with no retaining wall or parapet, over 18 m |
| MAJOR | missing-guard | 296–298 | [1309, 55.8, 752.2] | 1.3 m drop | static | right edge: 1.3 m drop at 5.25 m from centre with no guard (onto terrain) over 4 m |
| MAJOR | transition | 298.5 | [1295.5, 54.9, 744.6] | -0.856 m step | static | structure.mountainRoadCanalBridge start: structure bed 55.78 vs road bed 55.79 (Δ 0 m, plan offset 0.05 m); 2 lips > 0.08 m within ±15 m, worst on line 1.5 m at 14.8 m: crack 0.86 m deep, 0.2 m wide between prisms (mountainRoadCanalBridge.deck@lakeside \| terrain showing) |
| MAJOR | seam | 313.2–313.3 | [1295.5, 54.9, 744.6] | -0.856 m step | static | crack 0.86 m deep, 0.2 m wide between prisms (mountainRoadCanalBridge.deck@lakeside \| terrain showing) on lines 3, 1.5 m |
| MAJOR | transition | 316.5 | [1295.5, 54.9, 744.6] | -0.856 m step | static | structure.mountainRoadCanalBridge end: structure bed 55.63 vs road bed 55.63 (Δ 0 m, plan offset 0.05 m); 3 lips > 0.08 m within ±15 m, worst on line 1.5 m at -3.2 m: crack 0.86 m deep, 0.2 m wide between prisms (mountainRoadCanalBridge.deck@lakeside \| terrain showing) |
| MINOR | buried | 0 | [1599.5, 35, 787.3] | 0.063 m terrain above deck | static | visible terrain 0.063 m above the deck inside the carriageway over 2 m |
| MINOR | unguarded-step | 2–8 | [1593.5, 35.4, 790.9] | 0.8 m drop | static | left edge: 0.8 m step off at 4.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 12–18 | [1583.5, 35.9, 791] | 0.93 m drop | static | left edge: 0.93 m step off at 4.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | seam | 13.7 | [1585.8, 35.3, 794] | -0.497 m step | static | crack 0.50 m deep, 0.2 m wide between prisms (V03.bed.prow@prow \| terrain showing) on lines -3, -1.5 m |
| MINOR | grade | 24–34 | [1575.5, 36.3, 791] | 8.09 % max | static | 10 m over 8 % (max 8.1 % per 10 m) |
| MINOR | unguarded-step | 32–40 | [1563.5, 37.3, 790.9] | 0.71 m drop | static | right edge: 0.71 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | grade | 46–212 | [1477.5, 45.1, 790] | 10 % max | static | 166 m over 8 % (max 10 % per 10 m) |
| MINOR | seam | 46.5 | [1553, 38, 793.7] | -0.208 m step | static | crack 0.21 m deep, 0.2 m wide between prisms (yearWalk.shoulders.prow@prow \| V03.bed.prow@prow showing) on lines -3 m |
| MINOR | seam | 90.7 | [1508.8, 42.1, 793] | -0.14 m step | static | crack 0.14 m deep, 0.2 m wide between prisms (yearWalk.shoulders.lakeside@prow \| V03.bed.lakeside@prow showing) on lines -3 m |
| MINOR | seam | 94.5–94.6 | [1505, 42.4, 793] | -0.158 m step | static | crack 0.16 m deep, 0.2 m wide between prisms (yearWalk.shoulders.lakeside@prow \| V03.bed.lakeside@prow showing) on lines -3, 3 m |
| MINOR | lip | 98.5–98.6 | [1500.9, 42.9, 793] | -0.138 m step | static | step down 0.14 m yearWalk.shoulders.lakeside@prow → terrain on lines 3, -3 m |
| MINOR | lip | 99.8 | [1499.7, 43.1, 793] | 0.134 m step | static | step up 0.13 m terrain → yearWalk.shoulders.lakeside@prow on lines -3 m |
| MINOR | seam | 203.1 | [1396.1, 52.9, 791.4] | -0.165 m step | static | crack 0.17 m deep, 0.2 m wide between prisms (V03.bed.lakeside@prow \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 206.9–207 | [1392.1, 53.1, 790.8] | -0.35 m step | static | crack 0.35 m deep, 0.3 m wide between prisms (V03.bed.lakeside@prow \| yearWalk.shoulders.lakeside@prow showing) on lines -3, -1.5 m |
| MINOR | seam | 210.6–210.7 | [1388.6, 53.3, 788.4] | -0.548 m step | static | crack 0.55 m deep, 0.2 m wide between prisms (V03.bed.lakeside@prow \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 213.8 | [1385.5, 53.4, 787.5] | -0.495 m step | static | crack 0.49 m deep, 0.2 m wide between prisms (V03.bed.lakeside@prow \| terrain showing) on lines -3, -1.5 m |
| MINOR | seam | 218.1 | [1380.9, 53.7, 787.5] | -0.289 m step | static | crack 0.29 m deep, 0.2 m wide between prisms (V03.bed.lakeside@prow \| yearWalk.shoulders.lakeside@prow showing) on lines -3 m |
| MINOR | seam | 236.3 | [1364.4, 54, 779.4] | -0.393 m step | static | crack 0.39 m deep, 0.2 m wide between prisms (V03.bed.lakeside@prow \| terrain showing) on lines -1.5 m |
| MINOR | unguarded-step | 284–294 | [1312.6, 55.6, 753.9] | 1.19 m drop | static | right edge: 1.19 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | floating-edge | 298 | [1309, 55.8, 752.2] | 0.69 m gap | static | right deck edge hangs 0.69 m over the terrain with no retaining wall or parapet, over 2 m |
| MINOR | seam | 318.4 | [1291, 55.1, 741.5] | -0.439 m step | static | crack 0.44 m deep, 0.2 m wide between prisms (V03.bed.lakeside@lakeside \| terrain showing) on lines 3 m |
| MINOR | junction-lip | 327 | [1279.3, 55.2, 748.2] | -0.122 m step | static | junction cross.v03.walkFootQuay.1 (V03 × walk footQuay): 1 lips > 0.08 m; worst on other+ at 6.58 m: step down 0.12 m yearWalk.bed.lakeside@lakeside → walk footQuay.bed.lakeside@lakeside |

## spur upperStreet — 5 m bed, 20 m

Drives: **fwd/centre** 18.5 m in 2.8 s sim (mean 6.54 m/s, max 11), 0 contact steps, 0 airborne steps · **rev/centre** 18.5 m in 2.8 s sim (mean 6.54 m/s, max 11), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | lip | 5.1–6.1 | [1478.1, 18, 1046.1] | -0.226 m step | static | step down 0.23 m V01.shoulders.harbour@harbour → town.upperStreet.slab@harbour on lines 1.88, 0, 0.94 m |
| MAJOR | junction-lip | 20 | [1482.5, 17.3, 1066.4] | -0.304 m step | static | junction cross.s3.spurUpperStreet.1 (spur upperStreet × S3): 1 lips > 0.08 m; worst on other+ at 6.83 m: step down 0.30 m walk square.bed.harbour@harbour → S3.surface.0.harbour@harbour |
| MAJOR | pad-lip | 20 | [1477.3, 18, 1046.4] | -0.271 m step | static (2×) | pad town.upperStreet (place, top 18 vs road bed 18): 2 lips between the road and 4 m inside the pad; worst 6.9 m out from the road centre: step down 0.27 m V01.shoulders.harbour@harbour → town.upperStreet.slab@harbour |
| MINOR | drive-lip | 5.5 | [1480, 18, 1045.4] | -0.115 m | fwd/centre | step down 0.11 m between V01.shoulders.harbour@harbour and town.upperStreet.slab@harbour |
| MINOR | drive-lip | 5.5 | [1480, 18.1, 1045.3] | 0.115 m | rev/centre | step up 0.11 m between town.upperStreet.slab@harbour and V01.shoulders.harbour@harbour |

## spur library — 5 m bed, 156.5 m

Drives: **fwd/centre** 155.5 m in 11.7 s sim (mean 13.26 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 155.5 m in 11.7 s sim (mean 13.26 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | junction-lip | 105 | [803.8, 46.1, 335.3] | -0.621 m step | static (6×) | junction cross.spurLibrary.yearWalk.1 (spur library × yearWalk): 6 lips > 0.08 m; worst on other+ at 2.86 m: step down 0.62 m spur library.bed.scholars@scholars → yearWalk.bed.scholars@scholars |
| BLOCKER | pad-lip | 112.5 | [809.8, 45.8, 332.2] | -0.936 m step | static (7×) | pad station.oct (station, top 45.5 vs road bed 46.77): 7 lips between the road and 4 m inside the pad; worst 2.6 m out from the road centre: step down 0.94 m spur library.bed.scholars@scholars → terrain |
| MAJOR | lip | 4.7 | [896.6, 47.9, 293.8] | -0.176 m step | static | step down 0.18 m VG.shoulders.scholars@scholars → V01.bed.scholars@scholars on lines -1.87 m |
| MAJOR | junction-lip | 156.5 | [761.6, 47.7, 362.5] | -0.184 m step | static (2×) | junction cross.spurLibrary.walkCoveWalk.1 (spur library × walk coveWalk): 2 lips > 0.08 m; worst on road-3 at -0.3 m: step down 0.18 m walk coveWalk.bed.scholars@scholars → terrain |
| MINOR | lip | 3.4 | [897.4, 47.9, 292.4] | -0.109 m step | static | step down 0.11 m VG.bed.scholars@scholars → V01.bed.scholars@scholars on lines -0.94 m |
| MINOR | unguarded-step | 96–112 | [810.6, 46.8, 334.7] | 1.12 m drop | static | right edge: 1.12 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 108 | [803.4, 46.7, 338.3] | 0.52 m drop | static | left edge: 0.52 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 112 | [799.8, 46.8, 340.1] | 0.51 m drop | static | left edge: 0.51 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## spur glasshouse — 5 m bed, 50 m

Drives: **fwd/centre** 41.5 m in 6.1 s sim (mean 6.84 m/s, max 16), 237 contact steps, 0 airborne steps, restarts: stall terrain @41.5 · **rev/centre** 49 m in 7 s sim (mean 5.71 m/s, max 15.7), 273 contact steps, 0 airborne steps, restarts: stall terrain @50

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | buried | 32–50 | [995.6, 45.2, 830.8] | 11.667 m terrain above deck | static | visible terrain 11.667 m above the deck inside the carriageway over 20 m |
| BLOCKER | stall | 41.5 | [993.4, 33, 835] | —  | fwd/centre | stalled against terrain (terrain/sim) |
| BLOCKER | incomplete | 41.5 | [993.4, 33, 835] | —  | fwd/centre | drive did not finish (42 of 49 m in 6 s) |
| BLOCKER | stall | 50 | [999.9, 34, 830.1] | —  | rev/centre | stalled against terrain (terrain/sim) |
| MAJOR | grade | 12–50 | [985.6, 32, 840.8] | 16.34 % max | static | 38 m over 8 % (max 16.3 % per 10 m) — over the 12 % profile maximum |
| MAJOR | lip | 39.3–45.1 | [992, 33.4, 834.8] | 0.196 m step | static | step up 0.20 m terrain → terrain on lines -1.87, -0.94, 0, 0.94 m |
| MAJOR | narrow | 44–48 | [998.4, 33.8, 831.2] | 3 m usable | static | usable width 3 m (< 4.5): left blocker spur glasshouse.retaining.lakeside@lakeside at 2.75 m, right steep at 0.25 m |
| MINOR | unguarded-step | 6 | [964.8, 30.1, 856.4] | 0.53 m drop | static | right edge: 0.53 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 18–22 | [976, 30.9, 848] | 0.73 m drop | static | left edge: 0.73 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | lip | 31–32.6 | [983.8, 32.4, 839.8] | 0.146 m step | static | step up 0.15 m terrain → terrain on lines -1.87 m |

## spur studio — 5 m bed, 26 m

Drives: **fwd/centre** 24.5 m in 3.3 s sim (mean 7.35 m/s, max 12.4), 0 contact steps, 0 airborne steps · **rev/centre** 24.5 m in 3.3 s sim (mean 7.35 m/s, max 12.4), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | drive-lip | 2 | [976, 40, 540] | -0.204 m | fwd/centre | step down 0.20 m between crossing.s4.vG.1.slab@hollow and spur studio.bed.hollow@hollow |
| MAJOR | drive-lip | 2 | [976, 40.2, 540] | 0.204 m | rev/centre | step up 0.20 m between spur studio.bed.hollow@hollow and crossing.s4.vG.1.slab@hollow |
| MAJOR | lip | 2.1 | [976.1, 40, 540] | -0.207 m step | static | step down 0.21 m crossing.s4.vG.1.slab@hollow → spur studio.bed.hollow@hollow on lines -1.87, -0.94, 0 m |
| MAJOR | junction-lip | 26 | [999, 40, 537] | 0.198 m step | static (2×) | junction cross.hostStudioApproach.spurStudio.1 (spur studio × host.studio.approach): 2 lips > 0.08 m; worst on road-3 at -1 m: step up 0.20 m terrain → host.studio.apron.slab@hollow |
| MINOR | seam | 3.6 | [977.6, 39.9, 538.1] | -0.088 m step | static | crack 0.09 m deep, 0.2 m wide between prisms (VG.bed.hollow@hollow \| spur studio.bed.hollow@hollow showing) on lines -1.87 m |
| MINOR | lip | 6.2 | [980.2, 39.9, 538.1] | -0.081 m step | static | step down 0.08 m VG.shoulders.hollow@hollow → terrain on lines -1.87 m |

## spur cottage — 5 m bed, 70.7 m

Drives: **fwd/centre** 69.5 m in 6.3 s sim (mean 10.93 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 69.5 m in 6.3 s sim (mean 10.93 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 8 | [975.9, 41.5, 700.1] | -0.393 m step | static (5×) | junction cross.spurCottage.yearWalk.1 (spur cottage × yearWalk): 5 lips > 0.08 m; worst on road-3 at -5.2 m: step down 0.39 m VG.bed.lakeside@hollow → yearWalk.bed.lakeside@hollow |
| MAJOR | junction-lip | 11.5 | [969.5, 41, 685.2] | -0.505 m step | static (5×) | junction cross.spurCottage.yearWalk.2 (spur cottage × yearWalk): 5 lips > 0.08 m; worst on road+3 at 6.4 m: step down 0.50 m yearWalk.shoulders.hollow@hollow → terrain |
| MAJOR | obstruction | 36 | [954.5, 40.2, 674.5] | 2.25 m from centre | static | parapet/rail spur cottage.edges.hollow@hollow inside the carriageway at 2.25 m from centre |
| MAJOR | junction-lip | 70.5 | [928.9, 38, 653.1] | -0.236 m step | static (2×) | junction cross.spurCottage.walkGarden.1 (spur cottage × walk garden): 2 lips > 0.08 m; worst on road-3 at -1.2 m: step down 0.24 m walk garden.bed.hollow@hollow → terrain |
| MINOR | lip | 2.7 | [976.8, 42, 699.4] | 0.084 m step | static | step up 0.08 m spur cottage.bed.hollow@hollow → VG.bed.hollow@hollow on lines -1.87 m |
| MINOR | floating-edge | 4 | [977.2, 41.9, 697.2] | 0.39 m gap | static | left deck edge hangs 0.39 m over the terrain with no retaining wall or parapet, over 2 m |
| MINOR | lip | 15.5–17.2 | [969.2, 41.5, 686.5] | -0.112 m step | static | step down 0.11 m yearWalk.shoulders.hollow@hollow → spur cottage.bed.hollow@hollow on lines -0.94, 0, 0.94, 1.88 m |
| MINOR | grade | 16–26 | [968.7, 41.6, 688.7] | 8.05 % max | static | 10 m over 8 % (max 8.1 % per 10 m) |
| MINOR | drive-lip | 16 | [968.6, 41.6, 688.6] | -0.084 m | fwd/centre | step down 0.08 m between yearWalk.shoulders.hollow@hollow and spur cottage.bed.hollow@hollow |
| MINOR | drive-lip | 16 | [968.7, 41.7, 688.7] | 0.082 m | rev/centre | step up 0.08 m between spur cottage.bed.hollow@hollow and yearWalk.shoulders.hollow@hollow |
| MINOR | unguarded-step | 28 | [960.2, 40.7, 680.2] | 1.13 m drop | static | left edge: 1.13 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | verge-drop | 32 | [957.4, 40.5, 677.4] | 1.43 m drop | static | left: 1.43 m drop 4.25 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 34 | [956, 40.3, 676] | 0.83 m drop | static | left edge: 0.83 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 34–36 | [954.5, 40.2, 674.5] | 0.98 m drop | static | right edge: 0.98 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 42–44 | [950.3, 39.8, 670.3] | 1.02 m drop | static | left edge: 1.02 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 42–44 | [950.3, 39.8, 670.3] | 1.02 m drop | static | right edge: 1.02 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | verge-drop | 46 | [947.5, 39.6, 667.5] | 1.27 m drop | static | right: 1.27 m drop 4.25 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 56–58 | [940.4, 39, 660.4] | 0.82 m drop | static | right edge: 0.82 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 64 | [934.8, 38.5, 654.8] | 0.8 m drop | static | right edge: 0.8 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## spur boathouse — 5 m bed, 36.4 m

Drives: **fwd/centre** 35 m in 6.3 s sim (mean 4.25 m/s, max 12), 241 contact steps, 0 airborne steps, restarts: stall V01.bed.landing@reach @4 · **rev/centre** 31.5 m in 5.6 s sim (mean 5.66 m/s, max 14.7), 241 contact steps, 0 airborne steps, restarts: stall V01.bed.landing@reach @4.5

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | lip | 4–4.2 | [1300.7, 7.4, 1375.6] | -0.582 m step | static | step down 0.58 m V01.bed.reach@reach → spur boathouse.bed.reach@reach on lines 0.94, 1.88, -0.94, 0, -1.87 m |
| BLOCKER | stall | 4–4.5 | [1298.9, 7.4, 1376.1] | —  | fwd/centre, rev/centre (2×) | stalled against V01.bed.landing@reach (bed/deck) |
| BLOCKER | incomplete | 4.5 | [1298.8, 7.4, 1375.7] | —  | rev/centre | drive did not finish (32 of 35 m in 6 s) |
| MAJOR | grade | 0–36 | [1298.9, 7.4, 1376.2] | 15.37 % max | static | 36 m over 8 % (max 15.4 % per 10 m) — over the 12 % profile maximum |
| MAJOR | narrow | 4 | [1298.9, 7.4, 1376.2] | 0.5 m usable | static | usable width 0.5 m (< 4.5): left blocker V01.bed.landing@reach at 0.25 m, right blocker V01.bed.landing@reach at 0.25 m |
| MAJOR | obstruction | 4 | [1298.9, 7.4, 1376.2] | 0.25 m from centre | static | bed/deck V01.bed.landing@reach inside the carriageway at 0.25 m from centre |
| MAJOR | obstruction | 4 | [1298.9, 7.4, 1376.2] | 0.25 m from centre | static | bed/deck V01.bed.landing@reach inside the carriageway at 0.25 m from centre |
| MAJOR | drive-lip | 4 | [1298.9, 7.4, 1376.1] | -0.454 m | fwd/centre | step down 0.45 m between V01.bed.landing@reach and spur boathouse.bed.reach@reach |
| MAJOR | contact | 4.5 | [1298.8, 7.4, 1375.7] | 1.93 s | rev/centre (3×) | in-lane contact with V01.bed.landing@reach (bed/deck) for 1.93 s, 0.1→0 m/s |
| MINOR | buried | 2 | [1301.4, 7.7, 1377.5] | 0.051 m terrain above deck | static | visible terrain 0.051 m above the deck inside the carriageway over 2 m |
| MINOR | surface-mismatch | 3–4 | [1298.9, 7.9, 1376.3] | 0.46 m vs bed | fwd/centre | rode above the bed line by 0.46 m on V01.bed.landing@reach |

## plot.terraces.1.service — 5 m bed, 31.5 m

Drives: **fwd/centre** 30 m in 3.7 s sim (mean 7.89 m/s, max 13.6), 0 contact steps, 0 airborne steps · **rev/centre** 30 m in 4 s sim (mean 7.41 m/s, max 13.2), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 8 | [1595.2, 31.5, 837.1] | -0.391 m step | static (5×) | junction cross.plotTerraces1Service.yearWalk.1 (plot.terraces.1.service × yearWalk): 5 lips > 0.08 m; worst on road-3 at 0 m: step down 0.39 m plot.terraces.1.layby.slab@prow → yearWalk.bed.prow@prow |
| MAJOR | pad-lip | 31 | [1589.9, 31.9, 830.2] | -0.251 m step | static | pad plot.terraces.1 (reserve, top 31.93 vs road bed 31.93): 1 lips between the road and 4 m inside the pad; worst 7.5 m out from the road centre: step down 0.25 m yearWalk.shoulders.prow@prow → terrain |
| MINOR | lip | 3.4 | [1597.6, 32.1, 830.8] | 0.105 m step | static | step up 0.11 m V01.bed.prow@prow → yearWalk.shoulders.prow@prow on lines 1.88 m |
| MINOR | unguarded-step | 14–20 | [1588.5, 31.9, 836.5] | 0.95 m drop | static | left edge: 0.95 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## plot.terraces.2.service — 5 m bed, 65.8 m

Drives: **fwd/centre** 64.5 m in 8.6 s sim (mean 6.25 m/s, max 16), 261 contact steps, 0 airborne steps, restarts: stall plot.terraces.2.retaining@prow @21.5 · **rev/centre** 64.5 m in 8.9 s sim (mean 6.25 m/s, max 16), 259 contact steps, 0 airborne steps, restarts: stall plot.terraces.2.retaining@prow @22.5

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 21–22.5 | [1567.6, 25.3, 901.9] | —  | fwd/centre, rev/centre (2×) | stalled against plot.terraces.2.retaining@prow (retainingWall/wall) |
| MAJOR | junction-lip | 0 | [1581.1, 25.1, 920.5] | -0.267 m step | static | junction cross.v01.plotTerraces2Service.1 (plot.terraces.2.service × V01): 1 lips > 0.08 m; worst on other- at 3.57 m: step down 0.27 m plot.terraces.2.layby.slab@prow → prowTunnel.floor@prow |
| MAJOR | buried | 4–10 | [1576.7, 25.5, 908.7] | 0.163 m terrain above deck | static | visible terrain 0.163 m above the deck inside the carriageway over 8 m |
| MAJOR | junction-lip | 7 | [1576.4, 25.5, 907] | -0.433 m step | static (4×) | junction cross.plotTerraces2Service.yearWalk.1 (plot.terraces.2.service × yearWalk): 4 lips > 0.08 m; worst on road+3 at 4.4 m: step down 0.43 m yearWalk.bed.prow@prow → terrain |
| MAJOR | narrow | 8 | [1576.7, 25.3, 911.5] | 4.25 m usable | static | usable width 4.25 m (< 4.5): left blocker prowTunnel.colonnade@prow at 1.75 m, right bank at 2.5 m |
| MAJOR | obstruction | 8 | [1576.7, 25.3, 911.5] | 1.75 m from centre | static | column/support prowTunnel.colonnade@prow inside the carriageway at 1.75 m from centre |
| MAJOR | scenery | 8–12 | [1576.7, 25.3, 911.5] | 1.5 m from centre | static | column/support prowTunnel.colonnade@prow inside the carriageway (1.5 m from centre, lowest face 0.3 m above the deck) |
| MAJOR | obstruction | 10–12 | [1575.3, 25.3, 910.1] | 1.5 m from centre | static | column/support prowTunnel.colonnade@prow inside the carriageway at 1.5 m from centre |
| MAJOR | lip | 10.4–11.3 | [1576, 25.4, 908.2] | -0.436 m step | static | step down 0.44 m yearWalk.bed.prow@prow → terrain on lines 0.94, -1.87, -0.94, 1.88, 0 m |
| MAJOR | drive-lip | 11 | [1574.3, 25.3, 909.2] | -0.415 m | fwd/centre | step down 0.42 m between yearWalk.shoulders.prow@prow and plot.terraces.2.service.bed.prow@prow |
| MAJOR | drive-lip | 11.5 | [1574.4, 25.7, 909.2] | 0.418 m | rev/centre | step up 0.42 m between plot.terraces.2.service.bed.prow@prow and yearWalk.shoulders.prow@prow |
| MAJOR | contact | 21–22.5 | [1566.2, 25.3, 901.3] | 0.19 s | fwd/centre, rev/centre (5×) | in-lane contact with plot.terraces.2.retaining@prow (retainingWall/wall) for 0.19 s, 3.7→0.3 m/s |
| MAJOR | narrow | 22 | [1566.8, 25.3, 901.6] | 1 m usable | static | usable width 1 m (< 4.5): left blocker plot.terraces.2.retaining@prow at 0.25 m, right blocker plot.terraces.2.retaining@prow at 0.75 m |
| MAJOR | obstruction | 22 | [1566.8, 25.3, 901.6] | 0.25 m from centre | static | retainingWall/wall plot.terraces.2.retaining@prow inside the carriageway at 0.25 m from centre |
| MAJOR | obstruction | 22 | [1566.8, 25.3, 901.6] | 0.75 m from centre | static | retainingWall/wall plot.terraces.2.retaining@prow inside the carriageway at 0.75 m from centre |
| MINOR | surface-mismatch | 9–11.5 | [1574.4, 25.7, 909.3] | 0.42 m vs bed | fwd/centre, rev/centre (2×) | rode above the bed line by 0.42 m on yearWalk.shoulders.prow@prow |
| MINOR | buried | 18 | [1571, 25.4, 903] | 0.058 m terrain above deck | static | visible terrain 0.058 m above the deck inside the carriageway over 2 m |

## plot.terraces.3.service — 5 m bed, 58.7 m

Drives: **fwd/centre** 57.5 m in 8.2 s sim (mean 5.73 m/s, max 14.1), 267 contact steps, 0 airborne steps, restarts: stall plot.terraces.3.retaining@prow @13.5 · **rev/centre** 57.5 m in 8.1 s sim (mean 6.03 m/s, max 15.9), 264 contact steps, 0 airborne steps, restarts: stall plot.terraces.3.retaining@prow @14.5

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 13.5–14.5 | [1544.5, 20.7, 974.7] | —  | fwd/centre, rev/centre (2×) | stalled against plot.terraces.3.retaining@prow (retainingWall/wall) |
| MAJOR | junction-lip | 7 | [1549.4, 20.2, 976.6] | -0.534 m step | static (5×) | junction cross.plotTerraces3Service.yearWalk.1 (plot.terraces.3.service × yearWalk): 5 lips > 0.08 m; worst on other- at 2.89 m: step down 0.53 m plot.terraces.3.service.bed.prow@prow → yearWalk.bed.prow@prow |
| MAJOR | contact | 13–15 | [1543.1, 20.7, 974.1] | 0.06 s | fwd/centre, rev/centre (3×) | in-lane contact with plot.terraces.3.retaining@prow (retainingWall/wall) for 0.06 s, 5→1.9 m/s |
| MAJOR | narrow | 14 | [1544, 20.7, 974.2] | 0.75 m usable | static | usable width 0.75 m (< 4.5): left blocker plot.terraces.3.retaining@prow at 0.25 m, right blocker plot.terraces.3.retaining@prow at 0.5 m |
| MAJOR | obstruction | 14 | [1544, 20.7, 974.2] | 0.25 m from centre | static | retainingWall/wall plot.terraces.3.retaining@prow inside the carriageway at 0.25 m from centre |
| MAJOR | obstruction | 14 | [1544, 20.7, 974.2] | 0.5 m from centre | static | retainingWall/wall plot.terraces.3.retaining@prow inside the carriageway at 0.5 m from centre |
| MINOR | unguarded-step | 8–12 | [1546, 20.7, 974.2] | 0.69 m drop | static | left edge: 0.69 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 16–20 | [1540, 20.7, 974.3] | 1.22 m drop | static | left edge: 1.22 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## plot.bight.1.service — 5 m bed, 68.3 m

Drives: **fwd/centre** 67 m in 8.7 s sim (mean 6.49 m/s, max 16), 248 contact steps, 0 airborne steps, restarts: stall plot.bight.1.retaining@bight @25.5 · **rev/centre** 67 m in 9.2 s sim (mean 6.34 m/s, max 16), 250 contact steps, 0 airborne steps, restarts: stall plot.bight.1.retaining@bight @27

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 25.5–27 | [853.3, 20.8, 930.6] | —  | fwd/centre, rev/centre (2×) | stalled against plot.bight.1.retaining@bight (retainingWall/wall) |
| MAJOR | contact | 25.5–27 | [852.1, 20.8, 929.6] | 0.06 s | fwd/centre, rev/centre (6×) | in-lane contact with plot.bight.1.retaining@bight (retainingWall/wall) for 0.06 s, 2.4→0.5 m/s |
| MAJOR | narrow | 26 | [852.9, 20.8, 930.4] | 0.5 m usable | static | usable width 0.5 m (< 4.5): left blocker plot.bight.1.retaining@bight at 0.25 m, right blocker plot.bight.1.retaining@bight at 0.25 m |
| MAJOR | obstruction | 26 | [852.9, 20.8, 930.4] | 0.25 m from centre | static | retainingWall/wall plot.bight.1.retaining@bight inside the carriageway at 0.25 m from centre |
| MAJOR | obstruction | 26 | [852.9, 20.8, 930.4] | 0.25 m from centre | static | retainingWall/wall plot.bight.1.retaining@bight inside the carriageway at 0.25 m from centre |
| MINOR | lip | 3.5 | [868.1, 20.8, 947.1] | -0.092 m step | static | step down 0.09 m VBS.bed.bight@bight → plot.bight.1.service.bed.bight@bight on lines 1.88 m |
| MINOR | junction-lip | 20 | [857.9, 20.7, 932.8] | -0.116 m step | static (5×) | junction cross.plotBight1Service.yearWalk.1 (plot.bight.1.service × yearWalk): 5 lips > 0.08 m; worst on other- at 2.8 m: step down 0.12 m plot.bight.1.service.bed.bight@bight → yearWalk.bed.bight@bight |

## plot.bight.2.service — 5 m bed, 74.6 m

Drives: **fwd/centre** 73.5 m in 9.1 s sim (mean 6.89 m/s, max 16), 243 contact steps, 0 airborne steps, restarts: stall plot.bight.2.retaining@bight @32.5 · **rev/centre** 73.5 m in 9.7 s sim (mean 6.66 m/s, max 16), 242 contact steps, 0 airborne steps, restarts: stall plot.bight.2.retaining@bight @34

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 32.5–34 | [812.8, 18.7, 986] | —  | fwd/centre, rev/centre (2×) | stalled against plot.bight.2.retaining@bight (retainingWall/wall) |
| MAJOR | contact | 32.5–34 | [811.7, 18.7, 985] | 0.03 s | fwd/centre, rev/centre (4×) | in-lane contact with plot.bight.2.retaining@bight (retainingWall/wall) for 0.03 s, 2.2→0.4 m/s |
| MAJOR | obstruction | 34 | [811.9, 18.7, 985] | 1.25 m from centre | static | retainingWall/wall plot.bight.2.retaining@bight inside the carriageway at 1.25 m from centre |
| MINOR | lip | 3.1–3.4 | [832, 18.7, 1008.1] | -0.13 m step | static | step down 0.13 m VBS.bed.bight@bight → plot.bight.2.service.bed.bight@bight on lines 0.94, 1.88 m |

## plot.bight.3.service — 5 m bed, 84.2 m

Drives: **fwd/centre** 83 m in 9.7 s sim (mean 7.46 m/s, max 16), 249 contact steps, 0 airborne steps, restarts: stall plot.bight.3.retaining@bight @41 · **rev/centre** 83 m in 10.5 s sim (mean 7.1 m/s, max 16), 250 contact steps, 0 airborne steps, restarts: stall plot.bight.3.retaining@bight @42.5

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 41–42.5 | [758.5, 16, 1061.1] | —  | fwd/centre, rev/centre (2×) | stalled against plot.bight.3.retaining@bight (retainingWall/wall) |
| MAJOR | contact | 41–42.5 | [758.5, 16, 1061] | 0.05 s | fwd/centre, rev/centre (6×) | in-lane contact with plot.bight.3.retaining@bight (retainingWall/wall) for 0.05 s, 2.5→0.6 m/s |
| MAJOR | narrow | 42 | [757.6, 16, 1060.7] | 0.5 m usable | static | usable width 0.5 m (< 4.5): left blocker plot.bight.3.retaining@bight at 0.25 m, right blocker plot.bight.3.retaining@bight at 0.25 m |
| MAJOR | obstruction | 42 | [757.6, 16, 1060.7] | 0.25 m from centre | static | retainingWall/wall plot.bight.3.retaining@bight inside the carriageway at 0.25 m from centre |
| MAJOR | obstruction | 42 | [757.6, 16, 1060.7] | 0.25 m from centre | static | retainingWall/wall plot.bight.3.retaining@bight inside the carriageway at 0.25 m from centre |
| MINOR | lip | 2.1 | [797.3, 16, 1064.6] | -0.099 m step | static | step down 0.10 m VBS.bed.bight@bight → plot.bight.3.layby.slab@bight on lines 1.88 m |

## plot.bight.4.service — 5 m bed, 78.1 m

Drives: **fwd/centre** 77 m in 9.3 s sim (mean 7.09 m/s, max 16), 253 contact steps, 0 airborne steps, restarts: stall plot.bight.4.retaining@bight @35 · **rev/centre** 77 m in 10 s sim (mean 6.79 m/s, max 16), 249 contact steps, 0 airborne steps, restarts: stall plot.bight.4.retaining@bight @36

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| BLOCKER | stall | 35–36.5 | [740.3, 14, 1128.4] | —  | fwd/centre, rev/centre (2×) | stalled against plot.bight.4.retaining@bight (retainingWall/wall) |
| MAJOR | contact | 34.5–36.5 | [740.4, 14, 1128.2] | 0.03 s | fwd/centre, rev/centre (6×) | in-lane contact with plot.bight.4.retaining@bight (retainingWall/wall) for 0.03 s, 4.5→2.1 m/s |
| MAJOR | narrow | 36 | [739.2, 14, 1128.3] | 0.5 m usable | static | usable width 0.5 m (< 4.5): left blocker plot.bight.4.retaining@bight at 0.25 m, right blocker plot.bight.4.retaining@bight at 0.25 m |
| MAJOR | obstruction | 36 | [739.2, 14, 1128.3] | 0.25 m from centre | static | retainingWall/wall plot.bight.4.retaining@bight inside the carriageway at 0.25 m from centre |
| MAJOR | obstruction | 36 | [739.2, 14, 1128.3] | 0.25 m from centre | static | retainingWall/wall plot.bight.4.retaining@bight inside the carriageway at 0.25 m from centre |

## Bight Bridge frame vs V01 spline

Straight frame [[460.68,12,1028.28],[661.39,12,1168.77]] (deck 21.6 m); V01 half-width + shoulder 5 m. Max lateral offset of the V01 centreline from the frame: **7.16 m** at station 2643.5.

| V01 station | t on frame | lateral m | heading Δ° |
|---:|---:|---:|---:|
| 2573.5 | 0.002 | 1.8 | 14.9 |
| 2578.5 | 0.022 | 2.91 | 11.4 |
| 2583.5 | 0.042 | 3.81 | 9.1 |
| 2588.5 | 0.062 | 4.51 | 7.4 |
| 2593.5 | 0.082 | 5.09 | 6 |
| 2598.5 | 0.103 | 5.57 | 4.9 |
| 2603.5 | 0.123 | 5.95 | 4 |
| 2608.5 | 0.143 | 6.27 | 3.3 |
| 2613.5 | 0.164 | 6.53 | 2.7 |
| 2618.5 | 0.184 | 6.73 | 2 |
| 2623.5 | 0.204 | 6.89 | 1.6 |
| 2628.5 | 0.225 | 7 | 1.1 |
| 2633.5 | 0.245 | 7.08 | 0.8 |
| 2638.5 | 0.266 | 7.13 | 0.4 |
| 2643.5 | 0.286 | 7.16 | 0.1 |
| 2648.5 | 0.306 | 7.15 | 0.2 |
| 2653.5 | 0.327 | 7.12 | 0.5 |
| 2658.5 | 0.347 | 7.07 | 0.7 |
| 2663.5 | 0.368 | 7 | 0.9 |
| 2668.5 | 0.388 | 6.92 | 1.1 |
| 2673.5 | 0.408 | 6.81 | 1.3 |
| 2678.5 | 0.429 | 6.7 | 1.4 |
| 2683.5 | 0.449 | 6.56 | 1.6 |
| 2688.5 | 0.47 | 6.42 | 1.7 |
| 2693.5 | 0.49 | 6.26 | 1.8 |
| 2698.5 | 0.51 | 6.1 | 2 |
| 2703.5 | 0.531 | 5.92 | 2.1 |
| 2708.5 | 0.551 | 5.74 | 2.2 |
| 2713.5 | 0.572 | 5.54 | 2.3 |
| 2718.5 | 0.592 | 5.34 | 2.3 |
| 2723.5 | 0.612 | 5.14 | 2.4 |
| 2728.5 | 0.633 | 4.93 | 2.4 |
| 2733.5 | 0.653 | 4.71 | 2.5 |
| 2738.5 | 0.674 | 4.49 | 2.5 |
| 2743.5 | 0.694 | 4.27 | 2.6 |
| 2748.5 | 0.714 | 4.04 | 2.6 |
| 2753.5 | 0.735 | 3.82 | 2.6 |
| 2758.5 | 0.755 | 3.59 | 2.6 |
| 2763.5 | 0.776 | 3.37 | 2.6 |
| 2768.5 | 0.796 | 3.15 | 2.5 |
| 2773.5 | 0.816 | 2.93 | 2.4 |
| 2778.5 | 0.837 | 2.72 | 2.4 |
| 2783.5 | 0.857 | 2.52 | 2.3 |
| 2788.5 | 0.878 | 2.33 | 2.1 |
| 2793.5 | 0.898 | 2.15 | 1.9 |
| 2798.5 | 0.918 | 2 | 1.6 |
| 2803.5 | 0.939 | 1.87 | 1.2 |
| 2808.5 | 0.959 | 1.78 | 0.7 |
| 2813.5 | 0.98 | 1.76 | 0.1 |
| 2818.5 | 1 | 1.81 | 1.2 |

## Structure transitions

| Structure | End | Road | Station | Structure bed y | Road bed y | Δ | Lips > 0.08 (±15 m, 5 lines) | Worst |
|---|---|---|---:|---:|---:|---:|---:|---|
| structure.highSpan | start | VG | 112.5 | 24 | 23.73 | 0.27 | 6 | MAJOR: crack 0.81 m deep, 0.2 m wide between prisms (VG.bed.notch@notch \| terrain showing) @ [1295.8, 22.9, 1101.3] |
| structure.highSpan | end | VG | 222.5 | 24 | 23.82 | 0.18 | 7 | MAJOR: step down 0.20 m highSpan.deck@notch → VG.bed.notch@notch @ [1184.9, 23.8, 1100.4] |
| structure.quayBridge | start | V01 | 3545.5 | 9 | 8.77 | 0.23 | 18 | MAJOR: crack 4.27 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) @ [1323.3, 4.7, 1373.3] |
| structure.quayBridge | end | V01 | 3641.5 | 9 | 9 | 0 | 2 | MAJOR: crack 0.95 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) @ [1366.8, 8.1, 1300.3] |
| structure.bightBridge.s2Ramp.sea | start | V01 | 2705.5 | 17.6 | 12 | 5.6 | 0 | — |
| structure.bightBridge.s2Ramp.sea | end | V01 | 2775.5 | 12 | 12 | 0 | 0 | — |
| structure.bightBridge.s2Flyover | end | V01 | 2705.5 | 17.6 | 12 | 5.6 | 0 | — |
| structure.bightBridge | start | V01 | 2572.5 | 12 | 12.09 | -0.09 | 6 | MAJOR: crack 1.93 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| terrain showing) @ [457.7, 10.1, 1031.9] |
| structure.bightBridge | end | V01 | 2818.5 | 12 | 11.98 | 0.02 | 2 | MINOR: crack 0.11 m deep, 0.2 m wide between prisms (V01.bed.bight@bight \| yearWalk.bed.bight@bight showing) @ [663.7, 11.8, 1169] |
| structure.mountainRoadCanalBridge | start | V03 | 298.5 | 55.78 | 55.79 | 0 | 2 | MAJOR: crack 0.86 m deep, 0.2 m wide between prisms (mountainRoadCanalBridge.deck@lakeside \| terrain showing) @ [1295.5, 54.9, 744.6] |
| structure.mountainRoadCanalBridge | end | V03 | 316.5 | 55.63 | 55.63 | 0 | 3 | MAJOR: crack 0.86 m deep, 0.2 m wide between prisms (mountainRoadCanalBridge.deck@lakeside \| terrain showing) @ [1295.5, 54.9, 744.6] |
| prowTunnel | start | V01 | 234.5 | 24.11 | 24.1 | 0.01 | 5 | MAJOR: step up 0.27 m prowTunnel.floor@prow → plot.terraces.2.layby.slab@prow @ [1583.9, 25.3, 921.6] |
| prowTunnel | end | V01 | 324.5 | 30.82 | 30.87 | -0.05 | 7 | BLOCKER: step up 0.61 m V01.bed.prow@prow → plot.terraces.1.layby.slab@prow @ [1601.5, 31.9, 839.9] |
| structure.bightSpurTrestle | start | VBS | 37 | 27.22 | 27.29 | -0.06 | 6 | MAJOR: crack 7.41 m deep, 0.2 m wide between prisms (VBS.bed.lakeside@bight \| terrain showing) @ [915, 19.1, 876.8] |
| structure.bightSpurTrestle | end | VBS | 110.5 | 21.98 | 21.9 | 0.07 | 2 | MAJOR: step up 0.18 m terrain → crossing.s4.vBS.1.slab@bight @ [872.4, 21.3, 938.6] |

## Junctions (threshold crossings)

| Crossing | Road | Other | Station | Lips > 0.08 | Worst |
|---|---|---|---:|---:|---|
| cross.v01.plotTerraces2Service.1 | plot.terraces.2.service | V01 | 0 | 1 | MAJOR: step down 0.27 m plot.terraces.2.layby.slab@prow → prowTunnel.floor@prow on other- @ [1581.1, 25.1, 920.5] |
| cross.s3.v01.3 | V01 | S3 | 3553.5 | 5 | MAJOR: crack 2.17 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on road+3 @ [1323.9, 6.8, 1374.7] |
| cross.s3.v01.1 | V01 | S3 | 3593.5 | 2 | MAJOR: crack 8.36 m deep, 0.2 m wide between prisms (quayBridge.deck@reach \| terrain showing) on road+3 @ [1350.5, 0.6, 1349.9] |
| cross.hostBoathouseApproach.spurBoathouse.1 | spur boathouse | host.boathouse.approach | 36 | 0 | — |
| cross.spurCottage.walkGarden.1 | spur cottage | walk garden | 70.5 | 2 | MAJOR: step down 0.24 m walk garden.bed.hollow@hollow → terrain on road-3 @ [928.9, 38, 653.1] |
| cross.spurCottage.yearWalk.2 | spur cottage | yearWalk | 11.5 | 5 | MAJOR: step down 0.50 m yearWalk.shoulders.hollow@hollow → terrain on road+3 @ [969.5, 41, 685.2] |
| cross.spurCottage.yearWalk.1 | spur cottage | yearWalk | 8 | 5 | MAJOR: step down 0.39 m VG.bed.lakeside@hollow → yearWalk.bed.lakeside@hollow on road-3 @ [975.9, 41.5, 700.1] |
| cross.spurLibrary.walkCoveWalk.1 | spur library | walk coveWalk | 156.5 | 2 | MAJOR: step down 0.18 m walk coveWalk.bed.scholars@scholars → terrain on road-3 @ [761.6, 47.7, 362.5] |
| cross.spurLibrary.yearWalk.1 | spur library | yearWalk | 105 | 6 | BLOCKER: step down 0.62 m spur library.bed.scholars@scholars → yearWalk.bed.scholars@scholars on other+ @ [803.8, 46.1, 335.3] |
| cross.hostStudioApproach.spurStudio.1 | spur studio | host.studio.approach | 26 | 2 | MAJOR: step up 0.20 m terrain → host.studio.apron.slab@hollow on road-3 @ [999, 40, 537] |
| cross.s3.spurUpperStreet.1 | spur upperStreet | S3 | 20 | 1 | MAJOR: step down 0.30 m walk square.bed.harbour@harbour → S3.surface.0.harbour@harbour on other+ @ [1482.5, 17.3, 1066.4] |
| cross.spurUpperStreet.walkSquare.1 | spur upperStreet | walk square | 20 | 0 | — |
| cross.v01.plotTerraces1Service.1 | V01 | plot.terraces.1.service | 339.5 | 1 | MINOR: step up 0.12 m yearWalk.shoulders.prow@prow → plot.terraces.1.layby.slab@prow on road+3 @ [1604.5, 31.9, 833.1] |
| cross.v01.plotTerraces2Service.2 | V01 | plot.terraces.2.service | 250.5 | 3 | MAJOR: step up 0.27 m prowTunnel.floor@prow → plot.terraces.2.layby.slab@prow on road+3 @ [1583.9, 25.3, 921.6] |
| cross.v01.plotTerraces3Service.1 | V01 | plot.terraces.3.service | 189 | 4 | MAJOR: step up 0.29 m V01.bed.prow@prow → plot.terraces.3.service.bed.prow@prow on road-3 @ [1553.4, 20.7, 976.5] |
| cross.s3.v01.4 | V01 | S3 | 3553.5 | 5 | MAJOR: crack 2.17 m deep, 0.3 m wide between prisms (V01.bed.reach@reach \| terrain showing) on road+3 @ [1323.9, 6.8, 1374.7] |
| cross.s3.v01.2 | V01 | S3 | 3593.5 | 2 | MAJOR: crack 8.36 m deep, 0.2 m wide between prisms (quayBridge.deck@reach \| terrain showing) on road+3 @ [1350.5, 0.6, 1349.9] |
| cross.v01.spurBoathouse.1 | V01 | spur boathouse | 3530.5 | 5 | MAJOR: step down 0.47 m V01.bed.landing@reach → spur boathouse.bed.reach@reach on other+ @ [1298.9, 7.4, 1376.1] |
| cross.v01.spurLibrary.1 | V01 | spur library | 1444 | 2 | MAJOR: step down 0.16 m VG.shoulders.scholars@scholars → V01.bed.scholars@scholars on road-3 @ [896.3, 47.9, 293.5] |
| cross.v01.spurUpperStreet.1 | V01 | spur upperStreet | 82.5 | 3 | MINOR: crack 0.21 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| spur upperStreet.bed.harbour@harbour showing) on road+3 @ [1477.7, 18, 1044.1] |
| cross.v01.townNorthLink.1 | V01 | town.northLink | 3817.5 | 0 | — |
| cross.v01.townRiverLink.1 | V01 | town.riverLink | 3681 | 2 | MINOR: crack 0.27 m deep, 0.2 m wide between prisms (V01.bed.reach@reach \| terrain showing) on road+3 @ [1373.1, 9.7, 1256.7] |
| cross.v01.v03.1 | V01 | V03 | 380 | 1 | BLOCKER: step up 0.54 m V01.bed.prow@prow → V03.bed.prow@prow on road-3 @ [1596.8, 35.2, 794.7] |
| cross.v01.vG.1 | V01 | VG | 1444 | 2 | MAJOR: step down 0.16 m VG.shoulders.scholars@scholars → V01.bed.scholars@scholars on road-3 @ [896.3, 47.9, 293.5] |
| cross.v01.vG.2 | V01 | VG | 0 | 0 | — |
| cross.v01.walkBightPier.1 | V01 | walk bightPier | 2425 | 4 | MINOR: step up 0.13 m V01.bed.flats@flats → walk bightPier.bed.flats@flats on road+0 @ [401.8, 28.4, 892.8] |
| cross.v01.walkCoveWalk.1 | V01 | walk coveWalk | 1664 | 2 | MINOR: crack 0.24 m deep, 0.2 m wide between prisms (V01.bed.scholars@scholars \| terrain showing) on road+3 @ [681.4, 41.4, 307.6] |
| cross.v01.walkReach.1 | V01 | walk reach | 3668.5 | 2 | MAJOR: step down 0.17 m V01.shoulders.reach@reach → walk reach.bed.reach@reach on other+ @ [1363.9, 9.1, 1270.1] |
| cross.v01.yearWalk.5 | V01 | yearWalk | 2941.5 | 2 | MAJOR: step down 0.17 m V01.shoulders.bight@bight → yearWalk.bed.bight@bight on other- @ [752.3, 8.8, 1250.3] |
| cross.v01.yearWalk.4 | V01 | yearWalk | 1533.5 | 4 | MAJOR: step down 0.19 m yearWalk.shoulders.scholars@scholars → V01.bed.scholars@scholars on road-3 @ [807, 45, 297.1] |
| cross.v01.yearWalk.6 | V01 | yearWalk | 3180 | 3 | BLOCKER: step down 0.72 m V01.bed.green@landing → yearWalk.bed.landing@landing on other+ @ [948.8, 3.9, 1379.3] |
| cross.v01.yearWalk.3 | V01 | yearWalk | 1010.5 | 3 | MAJOR: step up 0.31 m V01.bed.crown@crown → yearWalk.shoulders.crown@crown on road-3 @ [1322.9, 74, 273.7] |
| cross.v01.yearWalk.1 | V01 | yearWalk | 118 | 5 | MAJOR: crack 0.77 m deep, 0.2 m wide between prisms (V01.bed.harbour@harbour \| terrain showing) on road+3 @ [1509.2, 14.5, 1031] |
| cross.v01.yearWalk.2 | V01 | yearWalk | 506 | 5 | BLOCKER: step up 0.51 m V01.bed.prow@prow → yearWalk.bed.prow@prow on road+3 @ [1588.8, 45.5, 667.2] |
| cross.v03.walkFootQuay.1 | V03 | walk footQuay | 327 | 1 | MINOR: step down 0.12 m yearWalk.bed.lakeside@lakeside → walk footQuay.bed.lakeside@lakeside on other+ @ [1279.3, 55.2, 748.2] |
| cross.v03.yearWalk.1 | V03 | yearWalk | 326.5 | 0 | — |
| cross.vBS.plotBight1Service.1 | VBS | plot.bight.1.service | 136 | 4 | BLOCKER: step down 0.58 m plot.bight.1.layby.slab@bight → terrain on road+3 @ [864.6, 20.2, 952.1] |
| cross.vBS.plotBight2Service.1 | VBS | plot.bight.2.service | 207 | 3 | MAJOR: step down 0.22 m plot.bight.2.layby.slab@bight → terrain on road+3 @ [828.5, 18.5, 1012.8] |
| cross.vBS.plotBight3Service.1 | VBS | plot.bight.3.service | 271 | 4 | MAJOR: step down 0.38 m plot.bight.3.layby.slab@bight → terrain on road+3 @ [794.9, 15.6, 1068.7] |
| cross.vBS.plotBight4Service.1 | VBS | plot.bight.4.service | 334 | 1 | MINOR: step up 0.09 m terrain → plot.bight.4.layby.slab@bight on road+3 @ [773.3, 14, 1121.1] |
| cross.s4.vBS.1 | VBS | S4 | 130 | 4 | MAJOR: step down 0.21 m S4.surface.1.bight@bight → terrain on road+3 @ [869.1, 20.9, 944.3] |
| cross.vBS.spurGlasshouse.1 | VBS | spur glasshouse | 0 | 0 | — |
| cross.vBS.yearWalk.5 | VBS | yearWalk | 163.5 | 4 | BLOCKER: step down 0.60 m yearWalk.shoulders.bight@bight → terrain on road+3 @ [850.5, 19.5, 976.3] |
| cross.vBS.yearWalk.2 | VBS | yearWalk | 9.5 | 3 | BLOCKER: step down 0.87 m yearWalk.bed.lakeside@lakeside → terrain on road+3 @ [948.3, 29.1, 861.3] |
| cross.vBS.yearWalk.1 | VBS | yearWalk | 6.5 | 2 | BLOCKER: step down 0.87 m yearWalk.bed.lakeside@lakeside → terrain on road+3 @ [948.3, 29.1, 861.3] |
| cross.s4.vG.1 | VG | S4 | 915 | 3 | MAJOR: step up 0.20 m spur studio.bed.hollow@hollow → crossing.s4.vG.1.slab@hollow on road+0 @ [975.8, 40.2, 540.5] |
| cross.vG.spurCottage.1 | VG | spur cottage | 744 | 2 | MINOR: step down 0.09 m spur cottage.bed.hollow@hollow → VG.bed.hollow@hollow on road+0 @ [980.5, 41.9, 696.9] |
| cross.vG.spurGlasshouse.1 | VG | spur glasshouse | 582.5 | 2 | MINOR: step up 0.08 m VG.bed.lakeside@lakeside → VBS.bed.lakeside@lakeside on road+0 @ [960.2, 29.9, 862.6] |
| cross.vG.spurLibrary.1 | VG | spur library | 1180 | 2 | MAJOR: crack 0.18 m deep, 0.4 m wide between prisms (VG.bed.scholars@scholars \| V01.bed.scholars@scholars showing) on road-3 @ [899.5, 48, 293.9] |
| cross.vG.spurStudio.1 | VG | spur studio | 911.5 | 6 | MAJOR: step up 0.20 m spur studio.bed.hollow@hollow → crossing.s4.vG.1.slab@hollow on other- @ [976, 40.2, 540] |
| cross.vBS.vG.1 | VG | VBS | 582.5 | 2 | MINOR: step up 0.08 m VG.bed.lakeside@lakeside → VBS.bed.lakeside@lakeside on road+0 @ [960.2, 29.9, 862.6] |
| cross.vG.walkBight.1 | VG | walk bight | 578 | 2 | MINOR: step up 0.08 m VG.bed.lakeside@lakeside → VBS.bed.lakeside@lakeside on road+0 @ [960.2, 29.9, 862.6] |
| cross.vG.yearWalk.3 | VG | yearWalk | 983.5 | 4 | MAJOR: step up 0.44 m VG.bed.scholars@hollow → yearWalk.bed.scholars@hollow on road-3 @ [943.2, 45.7, 478.1] |
| cross.vG.yearWalk.2 | VG | yearWalk | 848 | 7 | MAJOR: step down 0.47 m VG.shoulders.hollow@hollow → yearWalk.bed.hollow@hollow on other- @ [1005.2, 37.8, 601.1] |
| cross.vG.yearWalk.1 | VG | yearWalk | 836 | 5 | MAJOR: step down 0.24 m yearWalk.shoulders.hollow@hollow → VG.bed.hollow@hollow on road-3 @ [997.6, 38.5, 606.8] |
| cross.plotBight1Service.yearWalk.1 | plot.bight.1.service | yearWalk | 20 | 5 | MINOR: step down 0.12 m plot.bight.1.service.bed.bight@bight → yearWalk.bed.bight@bight on other- @ [857.9, 20.7, 932.8] |
| cross.plotTerraces1Service.yearWalk.1 | plot.terraces.1.service | yearWalk | 8 | 5 | MAJOR: step down 0.39 m plot.terraces.1.layby.slab@prow → yearWalk.bed.prow@prow on road-3 @ [1595.2, 31.5, 837.1] |
| cross.plotTerraces2Service.yearWalk.1 | plot.terraces.2.service | yearWalk | 7 | 4 | MAJOR: step down 0.43 m yearWalk.bed.prow@prow → terrain on road+3 @ [1576.4, 25.5, 907] |
| cross.plotTerraces3Service.yearWalk.1 | plot.terraces.3.service | yearWalk | 7 | 5 | MAJOR: step down 0.53 m plot.terraces.3.service.bed.prow@prow → yearWalk.bed.prow@prow on other- @ [1549.4, 20.2, 976.6] |

## Pads touching a road

| Pad | Kind | Road | Station | Pad top | Road bed | Lips | Worst |
|---|---|---|---:|---:|---:|---:|---|
| station.oct | station | spur library | 112.5 | 45.5 | 46.77 | 7 | BLOCKER: step down 0.94 m spur library.bed.scholars@scholars → terrain @ [809.8, 45.8, 332.2] |
| town.upperStreet | place | V01 | 64 | 18 | 19.13 | 1 | BLOCKER: step down 0.97 m V01.shoulders.harbour@harbour → terrain @ [1463.7, 18.2, 1050.5] |
| town.upperStreet | place | spur upperStreet | 20 | 18 | 18 | 2 | MAJOR: step down 0.27 m V01.shoulders.harbour@harbour → town.upperStreet.slab@harbour @ [1477.3, 18, 1046.4] |
| tidelinePark | place | V01 | 3255 | 3 | 5.12 | 7 | BLOCKER: step down 2.55 m V01.shoulders.landing@landing → terrain @ [1003.4, 3.1, 1392] |
| plot.terraces.1 | reserve | plot.terraces.1.service | 31 | 31.93 | 31.93 | 1 | MAJOR: step down 0.25 m yearWalk.shoulders.prow@prow → terrain @ [1589.9, 31.9, 830.2] |
| plot.terraces.1.apron | landing | plot.terraces.1.service | 28.5 | 31.93 | 31.93 | 0 | — |
| plot.terraces.1.layby | landing | V01 | 339.5 | 31.93 | 31.94 | 1 | MAJOR: step down 0.43 m plot.terraces.1.layby.slab@prow → V01.bed.prow@prow @ [1602.8, 31.5, 837.2] |
| plot.terraces.1.layby | landing | plot.terraces.1.service | 0 | 31.93 | 31.93 | 0 | — |
| plot.terraces.2 | reserve | plot.terraces.2.service | 65.5 | 25.31 | 25.31 | 0 | — |
| plot.terraces.2.apron | landing | plot.terraces.2.service | 63 | 25.31 | 25.31 | 0 | — |
| plot.terraces.2.layby | landing | V01 | 250.5 | 25.31 | 25.3 | 0 | — |
| plot.terraces.2.layby | landing | plot.terraces.2.service | 0 | 25.31 | 25.31 | 0 | — |
| plot.terraces.3 | reserve | plot.terraces.3.service | 58.5 | 20.7 | 20.7 | 0 | — |
| plot.terraces.3.apron | landing | plot.terraces.3.service | 55.5 | 20.7 | 20.7 | 0 | — |
| plot.terraces.3.layby | landing | V01 | 189 | 20.7 | 20.7 | 0 | — |
| plot.terraces.3.layby | landing | plot.terraces.3.service | 0 | 20.7 | 20.7 | 0 | — |
| plot.bight.1 | reserve | plot.bight.1.service | 68 | 20.8 | 20.8 | 0 | — |
| plot.bight.1.apron | landing | plot.bight.1.service | 65.5 | 20.8 | 20.8 | 0 | — |
| plot.bight.1.layby | landing | VBS | 136 | 20.8 | 20.81 | 0 | — |
| plot.bight.1.layby | landing | plot.bight.1.service | 0 | 20.8 | 20.8 | 0 | — |
| plot.bight.2 | reserve | plot.bight.2.service | 74.5 | 18.72 | 18.72 | 0 | — |
| plot.bight.2.apron | landing | plot.bight.2.service | 71.5 | 18.72 | 18.72 | 0 | — |
| plot.bight.2.layby | landing | VBS | 207 | 18.72 | 18.71 | 0 | — |
| plot.bight.2.layby | landing | plot.bight.2.service | 0 | 18.72 | 18.72 | 0 | — |
| plot.bight.3 | reserve | plot.bight.3.service | 84 | 15.99 | 15.99 | 0 | — |
| plot.bight.3.apron | landing | plot.bight.3.service | 81 | 15.99 | 15.99 | 0 | — |
| plot.bight.3.layby | landing | VBS | 271 | 15.99 | 16.01 | 0 | — |
| plot.bight.3.layby | landing | plot.bight.3.service | 0 | 15.99 | 15.99 | 0 | — |
| plot.bight.4 | reserve | plot.bight.4.service | 78 | 14 | 14 | 0 | — |
| plot.bight.4.apron | landing | plot.bight.4.service | 75 | 14 | 14 | 0 | — |
| plot.bight.4.layby | landing | VBS | 334 | 14 | 14 | 0 | — |
| plot.bight.4.layby | landing | plot.bight.4.service | 0 | 14 | 14 | 0 | — |
| host.studio | host | spur studio | 26 | 40 | 40 | 0 | — |
| host.studio.apron | landing | spur studio | 26 | 40 | 40 | 0 | — |

## Limits of this audit

- Board, bicycle and walker bodies are not driven here (their kernels treat 0.10–0.12 m as a wall); only the cruiser.
- Visual-only checks (markings, lighting, texture) are out of scope; `scenery` covers collision solids and v2 planting positions only. Horizon land has no planting of its own in this bake.
- The Mountain v2 provider is registered always-drawn (`provider`), as the ride tests do; at runtime its decks answer only while its scene is drawn.
- The driver is scripted: a human steers differently. Contacts on the +2 m lane on narrow stretches are expected physics, graded by whether the rider was still inside the carriageway.
- Only the cruiser's own collision queries are used; the camera (`cameraBlocked`) and visual pop-in are not audited.
- Debug aids: `--trace <bed>:<fwd|rev>:<0|2>:<from>:<to>` prints every step of one pass in a station window; `--probe-line x0,z0,x1,z1,y` prints the surface every 0.1 m along a line and the lips found.
