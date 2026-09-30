# Horizon road audit — before

Driver's-eye audit of the committed bake with the real cruiser sim (`stepCruiser`, CRUISER.dt = 1/120 s). Read-only: nothing under `src/` or `public/` was changed.

- Command: `node scripts/horizon/road-audit.mjs --out docs/horizon/evidence/bridges/after/road` (from the repo root)
- Checkout: `e77309efbc48a76e8328f2b427613ecc6082bb61`; world `public/horizon/world/horizon-geo-1.json.gz` sha256 `c662fb3bed3aaa02…`, terrain sha256 `2ebc6cd90226c63b…` (horizon-geo-1)
- Wall-clock: **160.8 s** on 8 CPUs (v24.21.0); generated 2026-09-30T08:56:25.899Z
- Roads: V01, VG, VBS, V03, spur upperStreet, spur library, spur glasshouse, spur studio, spur cottage, spur boathouse, plot.terraces.1.service, plot.terraces.2.service, plot.terraces.3.service, plot.bight.1.service, plot.bight.2.service, plot.bight.3.service, plot.bight.4.service

## Method

- **World**: `parseHorizonDefinition(horizon-geo-1.json.gz)` + `decodeTerrainAsset(bin,'full')` + `createHorizonGeography(field,{...collision, solids, diagnostics})` + `addDynamic(createMountainV2Region(...).provider)` — the loader of `test/horizonRideSituations.test.ts`.
- **Drive**: pure pursuit (lookahead 6–8 m) on the lane line; target speed = min(16, √(4/κ)) braked back at 5 m/s²; throttle/coast/brake only through `stepCruiser` inputs; no snapping. Passes: forward and reverse, centreline and keep-right +2 m (5 m-wide spurs: centreline only). V01 is driven round the whole loop (+10 m). A stall longer than 2 s, or leaving the corridor (> half-width + shoulder + 5 m, or 4 m below the bed), is logged and the drive restarts 6–8 m further on (listed per pass).
- **Static** (every 2 m station, no driving): *lateral scan* both sides in 0.25 m steps from the centreline at the deck height — `geography.contact` (r 0.2) at the rider's body band, surface continuity (±0.5 m), water, > 40°, or no ground; a transverse crack between segment prisms (deck continues 0.15 m either side along the road, or within 0.6 m further out) is stepped over, not an edge → usable width, drop depth beyond the first edge. *Missing guard* = a drop > 1.25 m that starts within the bed edge + 1.5 m with no rail/wall stopping the scan first (drops further out are listed as MINOR `verge-drop`). *Unguarded step* = 0.5–1.25 m drop at the edge. *Buried* = visible terrain above the deck at five points across the carriageway (skipped under a roof whose underside is below that terrain). *Floating edge* = deck-edge bottom (deck − 0.6 m) more than 0.3 m above the terrain 0.3 m outside the edge with no wall/rail/support solid below it (not on structures). *Headroom* = every downward-facing static face whose plan falls inside the carriageway box of that station with its underside 0.1–5 m above the deck (this road's own parapet coping excluded), plus the dynamic (Mountain v2) ceiling. *Kerbs* = own kerb solid at ±half-width. *Scenery* = non-walkable static solids not belonging to the road, and v2 dynamic solids, within the carriageway + 1 m, 0.3–4.5 m above the deck.
- **Lips** (every 0.1 m along five lines at 0, ±0.375, ±0.75 × half-width, interpolated so a line never cuts a corner): step in the physical surface with the local grade removed, > 0.08 m. A run of steps that returns to its starting height within 0.6 m is one *crack* (gap) or *ridge* — the 1.12 m wheelbase bridges a crack ≤ 0.3 m wide, so such a crack is MAJOR only when deeper than groundSnap (a foot, a board wheel or the rider's centre can fall in), else MINOR. *Junctions*: every threshold crossing of a road — the other route's bed ±20 m (to the road edge + 6 m) and the road ±15 m on three lines. *Pads*: every non-threshold pad within reach of a road — three lines from the road into 4 m inside the pad. *Transitions*: ±15 m on five lines at every structure-bed end within 12 m of a road. *v2 planting*: `mountainPlanting('full')` trees and shrubs kept where the region draws them, against every road (trunk inside the carriageway, within 1 m of it, or crown below 2.8 m over it).
- **Cross-reference**: every static finding lists the driving events (type:pass) within ±6 m of it, so "a lip exists" and "the cruiser felt it" stay separate facts.
- **Sampling**: nothing was sub-sampled beyond the steps above; the whole run took 160.8 s.
- **Severity**: BLOCKER = stops or launches the cruiser (stall, airborne > 0.1 s, lip up > 0.48 m or down > 0.55 m that is not a narrow crack, hole), buries it (terrain > 0.48 m over the deck), or headroom < 1.55 m. MAJOR = lip > 0.15 m, crack deeper than 0.55 m, missing guard over a > 1.25 m drop, usable width < 7 m (8 m roads) / < width − 0.5 m (5 m spurs), grade > 12 % per 10 m, contact while inside the carriageway, obstruction inside the carriageway at body height, buried 0.15–0.48 m, floating edge > 1 m, headroom < 5 m, v2 tree trunk in the carriageway, the Bight Bridge frame mismatch when V01's edge leaves the deck. MINOR otherwise.

## Totals

| Road | Length m | BLOCKER | MAJOR | MINOR | Drives (dir/lane: distance, restarts) | Kerb cover L/R |
|---|---:|---:|---:|---:|---|---|
| V01 | 3891.3 | 0 | 3 | 35 | fwd/centre: 3901.5 m, 0r; fwd/right+2: 3901.5 m, 0r; rev/centre: 3901.5 m, 0r; rev/right+2: 3901.5 m, 0r | 24% / 25% |
| VG | 1180.3 | 0 | 0 | 8 | fwd/centre: 1179 m, 0r; fwd/right+2: 1179 m, 0r; rev/centre: 1179 m, 0r; rev/right+2: 1179 m, 0r | 0% / 0% |
| VBS | 334.3 | 0 | 5 | 13 | fwd/centre: 333 m, 0r; rev/centre: 333 m, 0r | 0% / 0% |
| V03 | 327.4 | 0 | 1 | 7 | fwd/centre: 326 m, 0r; fwd/right+2: 326 m, 0r; rev/centre: 326 m, 0r; rev/right+2: 326 m, 0r | 0% / 0% |
| spur upperStreet | 20 | 0 | 2 | 0 | fwd/centre: 18.5 m, 0r; rev/centre: 18.5 m, 0r | 0% / 0% |
| spur library | 156.5 | 0 | 3 | 1 | fwd/centre: 155.5 m, 0r; rev/centre: 155.5 m, 0r | 0% / 0% |
| spur glasshouse | 50 | 0 | 2 | 0 | fwd/centre: 49 m, 0r; rev/centre: 49 m, 0r | 0% / 0% |
| spur studio | 26 | 0 | 1 | 0 | fwd/centre: 24.5 m, 0r; rev/centre: 24.5 m, 0r | 0% / 0% |
| spur cottage | 70.7 | 0 | 1 | 12 | fwd/centre: 69.5 m, 0r; rev/centre: 69.5 m, 0r | 0% / 0% |
| spur boathouse | 36.4 | 0 | 1 | 0 | fwd/centre: 35 m, 0r; rev/centre: 35 m, 0r | 0% / 0% |
| plot.terraces.1.service | 27.7 | 0 | 1 | 2 | fwd/centre: 26.5 m, 0r; rev/centre: 26.5 m, 0r | 0% / 0% |
| plot.terraces.2.service | 62.5 | 0 | 1 | 2 | fwd/centre: 61.5 m, 0r; rev/centre: 61 m, 0r | 0% / 0% |
| plot.terraces.3.service | 55.7 | 0 | 1 | 2 | fwd/centre: 55 m, 0r; rev/centre: 54.5 m, 0r | 0% / 0% |
| plot.bight.1.service | 67.2 | 0 | 1 | 2 | fwd/centre: 66 m, 0r; rev/centre: 66.5 m, 0r | 0% / 0% |
| plot.bight.2.service | 73.5 | 0 | 0 | 0 | fwd/centre: 72.5 m, 0r; rev/centre: 73 m, 0r | 0% / 0% |
| plot.bight.3.service | 83.3 | 0 | 0 | 2 | fwd/centre: 82 m, 0r; rev/centre: 83 m, 0r | 0% / 0% |
| plot.bight.4.service | 77.9 | 0 | 0 | 2 | fwd/centre: 76.5 m, 0r; rev/centre: 77 m, 0r | 0% / 0% |
| **all** | | **0** | **23** | **88** | | |

Issue counts are after merging the same driving event (same type and solid within 6 m) across passes and merging static stations into runs.

## Top issues (BLOCKER, then MAJOR; main roads first)

| # | Sev | Road | Station m | At [x, y, z] | Type | Cause | Seen by drives |
|---:|---|---|---|---|---|---|---|
| 1 | MAJOR | V01 | 118 | [1518.2, 16.5, 1034.8] | junction-lip | junction cross.v01.yearWalk.1 (V01 × yearWalk): 1 lips > 0.08 m; worst on other- at 10.42 m: step down 0.53 m yearWalk.shoulders.harbour@harbour → yearWalk.bed.harbour@harbour | — |
| 2 | MAJOR | V01 | 3256.5 | [1025.6, 5, 1396.1] | pad-lip | pad tidelinePark (place, top 3 vs road bed 5.34): 9 lips between the road and 4 m inside the pad; worst 5.3 m out from the road centre: step down 0.48 m V01.corridor.kerb.R.5.landing@landing → terrain | — |
| 3 | MAJOR | V01 | 2424 | [411.8, 24.5, 896.5] | junction-lip | junction cross.v01.walkBightPier.1 (V01 × walk bightPier): 1 lips > 0.08 m; worst on other+ at 10.36 m: step up 0.16 m walk bightPier.bed.flats@flats → yearWalk.shoulders.flats@flats | — |
| 4 | MAJOR | V03 | 327 | [1278.4, 55.1, 750.7] | junction-lip | junction cross.v03.walkFootQuay.1 (V03 × walk footQuay): 1 lips > 0.08 m; worst on other+ at 9.21 m: step down 0.21 m yearWalk.shoulders.lakeside@lakeside → walk footQuay.bed.lakeside@lakeside | — |
| 5 | MAJOR | VBS | 9.5 | [951.7, 29.6, 869] | junction-lip | junction cross.vBS.yearWalk.2 (VBS × yearWalk): 2 lips > 0.08 m; worst on other- at 5.65 m: step down 0.28 m walk bight.bed.lakeside@lakeside → yearWalk.bed.lakeside@lakeside | — |
| 6 | MAJOR | VBS | 6.5 | [954.7, 29.6, 867.9] | junction-lip | junction cross.vBS.yearWalk.1 (VBS × yearWalk): 1 lips > 0.08 m; worst on other- at 5.65 m: step down 0.17 m walk bight.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside | — |
| 7 | MAJOR | VBS | 110.5 | [872.1, 21.3, 939.1] | transition | structure.bightSpurTrestle end: structure bed 22.09 vs road bed 22.08 (Δ 0.01 m, plan offset 0.22 m); 1 lips > 0.08 m within ±15 m, worst on line 3 m at 13.6 m: step up 0.17 m terrain → S4.surface.1.bight@bight | — |
| 8 | MAJOR | VBS | 130 | [872.1, 21.3, 939.1] | junction-lip | junction cross.s4.vBS.1 (VBS × S4): 1 lips > 0.08 m; worst on road+3 at -5.9 m: step up 0.17 m terrain → S4.surface.1.bight@bight | — |
| 9 | MAJOR | VBS | 163.5 | [854.3, 20.1, 969.8] | junction-lip | junction cross.vBS.yearWalk.5 (VBS × yearWalk): 2 lips > 0.08 m; worst on road+3 at -3.9 m: step up 0.16 m terrain → yearWalk.shoulders.bight@bight | — |
| 10 | MAJOR | spur boathouse | 4–36 | [1297.3, 7.8, 1370.4] | grade | 32 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum | — |
| 11 | MAJOR | spur glasshouse | 16–50 | [982.4, 31.4, 843.2] | grade | 34 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum | — |
| 12 | MAJOR | spur glasshouse | 44 | [995.2, 33.3, 833.6] | scenery | retainingWall/wall walk glasshouseSteps.retaining.lakeside@lakeside inside the carriageway (2.5 m from centre, lowest face 0.3 m above the deck) | — |
| 13 | MAJOR | plot.bight.1.service | 17.5 | [854.3, 20.2, 931.3] | junction-lip | junction cross.plotBight1Service.yearWalk.1 (plot.bight.1.service × yearWalk): 5 lips > 0.08 m; worst on road+3 at 5.9 m: step down 0.43 m yearWalk.shoulders.bight@bight → terrain | — |
| 14 | MAJOR | spur library | 112.5 | [798.2, 45.9, 338.1] | pad-lip | pad station.oct (station, top 45.5 vs road bed 46.23): 4 lips between the road and 4 m inside the pad; worst 2.5 m out from the road centre: step down 0.38 m spur library.corridor.deck.1.scholars@scholars → terrain | — |
| 15 | MAJOR | spur studio | 26 | [999, 40, 543] | junction-lip | junction cross.hostStudioApproach.spurStudio.1 (spur studio × host.studio.approach): 2 lips > 0.08 m; worst on road+3 at -1 m: step up 0.36 m terrain → host.studio.apron.slab@hollow | — |
| 16 | MAJOR | spur library | 105 | [799.7, 45.9, 336.8] | junction-lip | junction cross.spurLibrary.yearWalk.1 (spur library × yearWalk): 4 lips > 0.08 m; worst on road+3 at 5.7 m: step down 0.32 m yearWalk.shoulders.scholars@scholars → terrain | — |
| 17 | MAJOR | spur cottage | 70.5 | [931.1, 38.4, 655.4] | junction-lip | junction cross.spurCottage.walkGarden.1 (spur cottage × walk garden): 2 lips > 0.08 m; worst on road-3 at -4.4 m: step up 0.31 m terrain → walk garden.bed.hollow@hollow | — |
| 18 | MAJOR | plot.terraces.3.service | 2 | [1549.3, 20.6, 966.4] | junction-lip | junction cross.plotTerraces3Service.yearWalk.1 (plot.terraces.3.service × yearWalk): 2 lips > 0.08 m; worst on road+3 at 3.6 m: step down 0.31 m plot.terraces.3.layby.slab@prow → terrain | — |
| 19 | MAJOR | spur upperStreet | 20 | [1482.5, 17.3, 1066.4] | junction-lip | junction cross.s3.spurUpperStreet.1 (spur upperStreet × S3): 1 lips > 0.08 m; worst on other+ at 6.83 m: step down 0.30 m walk square.bed.harbour@harbour → S3.surface.0.harbour@harbour | — |
| 20 | MAJOR | spur library | 156.5 | [761.6, 47.6, 362.5] | junction-lip | junction cross.spurLibrary.walkCoveWalk.1 (spur library × walk coveWalk): 3 lips > 0.08 m; worst on road-3 at -0.3 m: step down 0.27 m walk coveWalk.bed.scholars@scholars → terrain | — |
| 21 | MAJOR | spur upperStreet | 20 | [1477.3, 18.1, 1046.4] | pad-lip | pad town.upperStreet (place, top 18 vs road bed 18): 1 lips between the road and 4 m inside the pad; worst 6.9 m out from the road centre: step down 0.25 m V01.corridor.deck.3.harbour@harbour → terrain | — |
| 22 | MAJOR | plot.terraces.2.service | 2 | [1573.8, 25.2, 910.6] | junction-lip | junction cross.plotTerraces2Service.yearWalk.1 (plot.terraces.2.service × yearWalk): 4 lips > 0.08 m; worst on road+3 at 5.1 m: step down 0.17 m yearWalk.shoulders.prow@prow → terrain | — |
| 23 | MAJOR | plot.terraces.1.service | 2.5 | [1589.9, 32, 828.5] | junction-lip | junction cross.plotTerraces1Service.yearWalk.1 (plot.terraces.1.service × yearWalk): 3 lips > 0.08 m; worst on road+3 at 3.2 m: step down 0.17 m yearWalk.shoulders.prow@prow → terrain | — |

## V01 route character (derived from the 50 m bins below)

| Stations m | Character | Districts | Elevation m | Year Walk beside | Pads |
|---|---|---|---|---|---|
| 0–50 | open | harbour | 23.4–23.4 | — |  |
| 50–100 | developed | harbour | 18.7–18.7 | — | town.upperStreet |
| 100–200 | open | harbour | 17.1–19.6 | 2/2 bins | plot.terraces.3.layby |
| 200–350 | gallery | prow | 23.3–30.8 | 3/3 bins | plot.terraces.2.layby, plot.terraces.3.layby, station.nov, plot.terraces.1.apron, plot.terraces.1.layby |
| 350–550 | open | prow | 34.5–45.7 | 4/4 bins | plot.terraces.1.layby |
| 550–650 | coastal | prow | 49.4–53.2 | 2/2 bins |  |
| 650–1050 | coastal cliff | crown | 56.9–74.8 | 8/8 bins |  |
| 1050–1250 | coastal | crown | 61.2–70.2 | 4/4 bins |  |
| 1250–1500 | open | crown, scholars | 47–58.2 | 5/5 bins |  |
| 1500–1600 | developed | scholars | 43.9–45.4 | 1/2 bins | station.oct |
| 1600–1750 | open | scholars | 40.1–42.5 | — |  |
| 1750–2450 | coastal | scholars, flats | 24.5–38.4 | 1/14 bins | station.jul |
| 2450–2550 | coastal cliff | flats | 15.9–20.9 | 2/2 bins |  |
| 2550–2850 | bridge | bight | 11.9–12 | 6/6 bins |  |
| 2850–2950 | coastal | bight | 9–9.6 | 2/2 bins |  |
| 2950–3200 | open | bight, landing | 4.6–9 | 1/5 bins |  |
| 3200–3250 | bridge | landing | 5.5–5.5 | — |  |
| 3250–3300 | developed | landing | 4.2–4.2 | — | tidelinePark |
| 3300–3550 | coastal | landing, reach | 2.9–7.5 | — | place.campfire |
| 3550–3650 | bridge | reach | 9–9 | — | homestead.landing |
| 3650–3891.3 | open | reach, harbour | 9.3–23.6 | — |  |

Rule: bridge/gallery from the deck under the centreline; *coastal cliff* = sea (terrain ≤ 0.3) within 40 m of the centreline and more than 15 m of drop within 40 m; *coastal* = sea within 80 m; *developed* = a station, town, host, homestead or place pad within 45 m; else *open*.

## V01 station chart (50 m bins)

| Station m | Section | District | Elev m | Sea | Max drop ≤40 m | Year Walk alongside | Min width m | Pads within 45 m |
|---|---|---|---:|---|---:|---|---:|---|
| 0–50 | junction | harbour | 23.4 | — | 10.8 | — | 15.5 |  |
| 50–100 | junction | harbour | 18.7 | — | 7.7 | — | 12.75 | town.upperStreet |
| 100–150 | junction | harbour | 17.1 | — | 4.1 | 6 m (Δh -0.1) | 16 |  |
| 150–200 | open road | harbour | 19.6 | — | 0.3 | 6.9 m (Δh 0.1) | 16 | plot.terraces.3.layby |
| 200–250 | gallery/tunnel | prow | 23.3 | — | 2 | 6.5 m (Δh 0) | 15.5 | plot.terraces.2.layby, plot.terraces.3.layby |
| 250–300 | gallery/tunnel | prow | 27.1 | — | 1.7 | 6.7 m (Δh -0.1) | 15.5 | station.nov, plot.terraces.2.layby |
| 300–350 | gallery/tunnel | prow | 30.8 | — | 0.2 | 5.6 m (Δh 0) | 15.75 | plot.terraces.1.apron, plot.terraces.1.layby |
| 350–400 | junction | prow | 34.5 | — | 2.3 | 6.9 m (Δh -0.2) | 16 | plot.terraces.1.layby |
| 400–450 | open road | prow | 38.3 | — | 8.2 | 6.5 m (Δh 0) | 15.75 |  |
| 450–500 | junction | prow | 42 | — | 5.8 | 8.9 m (Δh -0.3) | 13.5 |  |
| 500–550 | junction | prow | 45.7 | — | 1.5 | 8.9 m (Δh 0) | 14.75 |  |
| 550–600 | open road | prow | 49.4 | 70 m right | 0.2 | 8.4 m (Δh 0.1) | 15 |  |
| 600–650 | open road | prow | 53.2 | 50 m right | 0.5 | 8.7 m (Δh -0.2) | 13.5 |  |
| 650–700 | open road | crown | 56.9 | 34 m right | 58.5 | 9.3 m (Δh 0) | 13.25 |  |
| 700–750 | open road | crown | 60.2 | 34 m right | 62.7 | 9.5 m (Δh 0.1) | 13.75 |  |
| 750–800 | open road | crown | 63.9 | 30 m right | 66.8 | 9.5 m (Δh -0.1) | 14.25 |  |
| 800–850 | open road | crown | 67.6 | 30 m right | 70.5 | 9 m (Δh 0.1) | 13.5 |  |
| 850–900 | open road | crown | 69.9 | 22 m right | 73.7 | 10.5 m (Δh 0) | 13.5 |  |
| 900–950 | open road | crown | 72.2 | 22 m right | 75.8 | 11.4 m (Δh -0.1) | 13.25 |  |
| 950–1000 | open road | crown | 74.8 | 34 m right | 75.3 | 6.9 m (Δh 0) | 13.75 |  |
| 1000–1050 | junction | crown | 73.1 | 34 m right | 75.2 | 7.1 m (Δh 0.1) | 14 |  |
| 1050–1100 | open road | crown | 70.2 | 42 m right | 71.1 | 7.9 m (Δh 0.1) | 14.75 |  |
| 1100–1150 | open road | crown | 67.2 | 54 m right | 30.7 | 8.1 m (Δh 0) | 13.75 |  |
| 1150–1200 | open road | crown | 64.2 | 66 m right | 28.4 | 7.3 m (Δh -0.1) | 13.75 |  |
| 1200–1250 | open road | crown | 61.2 | 70 m right | 26.2 | 6.2 m (Δh 0) | 14 |  |
| 1250–1300 | open road | crown | 58.2 | — | 24.2 | 6.6 m (Δh -0.1) | 13.75 |  |
| 1300–1350 | open road | scholars | 55.2 | — | 22 | 6.5 m (Δh 0.1) | 14 |  |
| 1350–1400 | open road | scholars | 52.2 | — | 21.1 | 6.5 m (Δh 0) | 14.5 |  |
| 1400–1450 | junction | scholars | 49.2 | — | 12.6 | 6.4 m (Δh 0) | 15.75 |  |
| 1450–1500 | junction | scholars | 47 | — | 2.6 | 18 m (Δh -0.6) | 16 |  |
| 1500–1550 | junction | scholars | 45.4 | — | 3.6 | 9.3 m (Δh -0.3) | 16 | station.oct |
| 1550–1600 | open road | scholars | 43.9 | — | 4.4 | — | 16 | station.oct |
| 1600–1650 | open road | scholars | 42.5 | — | 4.5 | — | 16 |  |
| 1650–1700 | junction | scholars | 41.4 | — | 3.8 | — | 15 |  |
| 1700–1750 | open road | scholars | 40.1 | — | 5.2 | — | 16 |  |
| 1750–1800 | open road | scholars | 37.6 | 78 m right | 5.7 | — | 15 |  |
| 1800–1850 | open road | scholars | 37.5 | 70 m right | 2.4 | — | 16 |  |
| 1850–1900 | open road | scholars | 38.4 | 62 m right | 1.1 | — | 16 |  |
| 1900–1950 | open road | flats | 37.2 | 58 m right | 1.5 | — | 16 |  |
| 1950–2000 | open road | flats | 35.7 | 54 m right | 1.5 | — | 16 |  |
| 2000–2050 | open road | flats | 34.7 | 54 m right | 1.5 | — | 16 |  |
| 2050–2100 | open road | flats | 34.3 | 62 m right | 1.6 | — | 16 |  |
| 2100–2150 | open road | flats | 34.1 | 62 m right | 1.5 | — | 16 |  |
| 2150–2200 | open road | flats | 34 | 62 m right | 1.7 | — | 16 |  |
| 2200–2250 | open road | flats | 34.1 | 66 m right | 1.8 | — | 16 |  |
| 2250–2300 | open road | flats | 33.2 | 70 m right | 1.4 | — | 16 | station.jul |
| 2300–2350 | open road | flats | 30.5 | 66 m right | 0.2 | — | 16 |  |
| 2350–2400 | open road | flats | 27.5 | 58 m right | 0.2 | — | 14.5 |  |
| 2400–2450 | junction | flats | 24.5 | 46 m right | 0.5 | 14.5 m (Δh -0.2) | 12.25 |  |
| 2450–2500 | open road | flats | 20.9 | 38 m right | 20.5 | 9.2 m (Δh -0.1) | 12.75 |  |
| 2500–2550 | open road | flats | 15.9 | 18 m right | 19.1 | 10.4 m (Δh 0.2) | 10.75 |  |
| 2550–2600 | bridge | bight | 12 | 6 m left | 21 | 6.7 m (Δh 0) | 10.5 |  |
| 2600–2650 | bridge, junction | bight | 12 | 6 m left | 24 | 0.4 m (Δh 0) | 16 |  |
| 2650–2700 | bridge, junction | bight | 12 | 6 m left | 24 | 1.4 m (Δh 0) | 16 |  |
| 2700–2750 | bridge | bight | 12 | 6 m left | 24 | 1.8 m (Δh 0) | 13.5 |  |
| 2750–2800 | bridge | bight | 12 | 6 m left | 24 | 4 m (Δh 0) | 13.25 |  |
| 2800–2850 | bridge | bight | 11.9 | 6 m left | 18.9 | 5 m (Δh 0) | 13 |  |
| 2850–2900 | open road | bight | 9.6 | 34 m right | 10.9 | 7.4 m (Δh 0.2) | 13.5 |  |
| 2900–2950 | junction | bight | 9 | 62 m right | 2.8 | 17.4 m (Δh 0) | 13.5 |  |
| 2950–3000 | junction | bight | 9 | — | 0.3 | — | 16 |  |
| 3000–3050 | open road | landing | 9 | — | 2.1 | — | 16 |  |
| 3050–3100 | open road | landing | 8.2 | — | 3.7 | — | 15 |  |
| 3100–3150 | open road | landing | 6 | — | 3.6 | — | 14.75 |  |
| 3150–3200 | junction | landing | 4.6 | — | 2.5 | 5.8 m (Δh -0.5) | 12.75 |  |
| 3200–3250 | bridge | landing | 5.5 | — | 2.9 | — | 12.5 |  |
| 3250–3300 | open road | landing | 4.2 | — | 2.9 | — | 13.5 | tidelinePark |
| 3300–3350 | open road | landing | 2.9 | 74 m right | 0.9 | — | 16 |  |
| 3350–3400 | open road | landing | 2.9 | 70 m right | 0.5 | — | 16 |  |
| 3400–3450 | open road | landing | 3.1 | 58 m right | 1.5 | — | 16 | place.campfire |
| 3450–3500 | open road | reach | 4.5 | 46 m right | 4.5 | — | 15 |  |
| 3500–3550 | junction | reach | 7.5 | 30 m right | 8.4 | — | 10.75 |  |
| 3550–3600 | bridge, junction | reach | 9 | 18 m right | 8.8 | — | 13.25 | homestead.landing |
| 3600–3650 | bridge, junction | reach | 9 | 38 m left | 9.1 | — | 12.5 | homestead.landing |
| 3650–3700 | junction | reach | 9.3 | — | 7.2 | — | 13.75 |  |
| 3700–3750 | open road | reach | 12.4 | — | 8.6 | — | 13.75 |  |
| 3750–3800 | open road | harbour | 15.9 | — | 9.8 | — | 13.25 |  |
| 3800–3850 | junction | harbour | 19.4 | — | 8.4 | — | 15.5 |  |
| 3850–3891.3 | open road | harbour | 23.6 | — | 10.6 | — | 15.5 |  |

## V01 — 8 m bed, 3891.3 m (closed loop)

Drives: **fwd/centre** 3901.5 m in 249.4 s sim (mean 15.64 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 3901.5 m in 249.9 s sim (mean 15.66 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 3901.5 m in 249.3 s sim (mean 15.64 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/right+2** 3901.5 m in 248.9 s sim (mean 15.62 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 118 | [1518.2, 16.5, 1034.8] | -0.527 m step | static | junction cross.v01.yearWalk.1 (V01 × yearWalk): 1 lips > 0.08 m; worst on other- at 10.42 m: step down 0.53 m yearWalk.shoulders.harbour@harbour → yearWalk.bed.harbour@harbour |
| MAJOR | junction-lip | 2424 | [411.8, 24.5, 896.5] | 0.164 m step | static | junction cross.v01.walkBightPier.1 (V01 × walk bightPier): 1 lips > 0.08 m; worst on other+ at 10.36 m: step up 0.16 m walk bightPier.bed.flats@flats → yearWalk.shoulders.flats@flats |
| MAJOR | pad-lip | 3256.5 | [1025.6, 5, 1396.1] | -0.478 m step | static (9×) | pad tidelinePark (place, top 3 vs road bed 5.34): 9 lips between the road and 4 m inside the pad; worst 5.3 m out from the road centre: step down 0.48 m V01.corridor.kerb.R.5.landing@landing → terrain |
| MINOR | grade | 24–82 | [1435.1, 22.4, 1052.2] | 10 % max | static | 58 m over 8 % (max 10 % per 10 m) |
| MINOR | unguarded-step | 72–74 | [1470, 18.8, 1043.4] | 0.81 m drop | static | right edge: 0.81 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | transition | 490 | — | 2.81 m step | static | structure.prowLoopFootbridge.meeting end: structure bed 45.95 vs road bed 43.14 (Δ 2.81 m, plan offset 11.31 m); no lip > 0.08 m within ±15 m |
| MINOR | verge-drop | 1236 | [1104.4, 60.5, 251.7] | 1.76 m drop | static | left: 1.76 m drop 7.75 m from centre (beyond the 5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 1268 | [1072.8, 58.6, 256.9] | 1.68 m drop | static | left: 1.68 m drop 7.75 m from centre (beyond the 5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | junction-lip | 1444 | [899.3, 48.1, 293.1] | 0.088 m step | static | junction cross.v01.spurLibrary.1 (V01 × spur library): 1 lips > 0.08 m; worst on road-3 at 1 m: step up 0.09 m V01.corridor.deck.1.scholars@scholars → spur library.corridor.deck.1.scholars@scholars |
| MINOR | junction-lip | 1444 | [899.3, 48.1, 293.1] | 0.088 m step | static | junction cross.v01.vG.1 (V01 × VG): 1 lips > 0.08 m; worst on road-3 at 1 m: step up 0.09 m V01.corridor.deck.1.scholars@scholars → spur library.corridor.deck.1.scholars@scholars |
| MINOR | lip | 1445 | [899.3, 48.1, 293.1] | 0.088 m step | static | step up 0.09 m V01.corridor.deck.1.scholars@scholars → spur library.corridor.deck.1.scholars@scholars on lines -3 m |
| MINOR | junction-lip | 1664 | [678.5, 41.4, 306.3] | -0.144 m step | static | junction cross.v01.walkCoveWalk.1 (V01 × walk coveWalk): 1 lips > 0.08 m; worst on other+ at 5.46 m: step down 0.14 m V01.corridor.deck.1.scholars@scholars → walk coveWalk.bed.scholars@scholars |
| MINOR | unguarded-step | 2430 | [401.8, 24.3, 899.4] | 0.52 m drop | static | left edge: 0.52 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2436 | [403.2, 24, 905.2] | 0.62 m drop | static | right edge: 0.62 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | grade | 2446–2558 | [410.9, 21.7, 934.2] | 10.01 % max | static | 112 m over 8 % (max 10 % per 10 m) |
| MINOR | unguarded-step | 2540–2542 | [438.5, 14.1, 1004.8] | 0.93 m drop | static | right edge: 0.93 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2562–2566 | [450.1, 12.4, 1021] | 1.16 m drop | static | right edge: 1.16 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | frame-mismatch | 2575–2815 | — | 1.8 m lateral | static | V01 spline vs the Bight Bridge straight frame: up to 1.8 m lateral at station 2575.5 (deck half-width 10.8, V01 edge 5) |
| MINOR | transition | 2675.5 | — | 5.6 m step | static | structure.bightBridge.s2Ramp.lagoon end: structure bed 17.6 vs road bed 12 (Δ 5.6 m, plan offset 10.57 m); no lip > 0.08 m within ±15 m |
| MINOR | transition | 2675.5 | — | 5.6 m step | static | structure.bightBridge.s2Flyover start: structure bed 17.6 vs road bed 12 (Δ 5.6 m, plan offset 10.57 m); no lip > 0.08 m within ±15 m |
| MINOR | transition | 2707.5 | — | 5.6 m step | static | structure.bightBridge.s2Ramp.sea start: structure bed 17.6 vs road bed 12 (Δ 5.6 m, plan offset 6.99 m); no lip > 0.08 m within ±15 m |
| MINOR | transition | 2707.5 | — | 5.6 m step | static | structure.bightBridge.s2Flyover end: structure bed 17.6 vs road bed 12 (Δ 5.6 m, plan offset 6.99 m); no lip > 0.08 m within ±15 m |
| MINOR | scenery | 2734–2774 | [590, 12, 1121] | 5 m from centre | static | handrail/rail bightBridge.s2Ramp.sea.rails@bight within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | scenery | 2802–2820 | [645.7, 12, 1160] | 5 m from centre | static | handrail/rail bightBridge.kerbRails@bight within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | double-parapet | 2814–3638 | — | 5 station-sides | static | two or more rail solids on one side of the deck at 5 station-sides (bightBridge.kerbRails@bight, bightBridge.rails@bight, V01.corridor.guard.L.5.reach@reach, quayBridge.rails@reach, V01.corridor.guard.R.6.reach@reach) |
| MINOR | scenery | 2824 | [663.7, 11.9, 1172.6] | 5 m from centre | static | parapet/rail S2.edges.bight@bight within 1 m of it (5 m from centre, lowest face 0.8 m above the deck) |
| MINOR | unguarded-step | 2826–2836 | [666.9, 11.8, 1174.9] | 1.1 m drop | static | right edge: 1.1 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2890 | [715.6, 9.3, 1213.3] | 0.62 m drop | static | right edge: 0.62 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2898 | [721.7, 9.1, 1218.4] | 0.67 m drop | static | right edge: 0.67 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 2904 | [726.4, 9.1, 1222.3] | 0.79 m drop | static | right edge: 0.79 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 3174–3176 | [945.7, 4.6, 1374.4] | 0.73 m drop | static | right edge: 0.73 m step off at 4.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | verge-drop | 3244 | [1014.1, 5.6, 1388.8] | 4.2 m drop | static | right: 4.2 m drop 7.5 m from centre (beyond the 5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | unguarded-step | 3258 | [1027.9, 5.3, 1391.1] | 0.71 m drop | static | right edge: 0.71 m step off at 5.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | grade | 3518–3534 | [1290.3, 7.3, 1381.9] | 8.63 % max | static | 16 m over 8 % (max 8.6 % per 10 m) |
| MINOR | unguarded-step | 3548 | [1315.4, 9, 1375.3] | 0.93 m drop | static | right edge: 0.93 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | junction-lip | 3670 | [1375.7, 8.7, 1276.6] | -0.108 m step | static | junction cross.v01.walkReach.1 (V01 × walk reach): 1 lips > 0.08 m; worst on other- at 7.96 m: step down 0.11 m V01.corridor.walk.R.5.reach@reach → walk reach.bed.reach@reach |
| MINOR | grade | 3820–3866 | [1376.7, 20.3, 1112.3] | 10.01 % max | static | 46 m over 8 % (max 10 % per 10 m) |
| MINOR | slow-corner | 3886.5–5 | [1399.9, 24, 1065.3] | 6.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 6.9 m, driver down to 5.3 m/s (cornerSpeed 8) |

## VG — 8 m bed, 1180.3 m

Drives: **fwd/centre** 1179 m in 76.5 s sim (mean 15.41 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 1179 m in 76.3 s sim (mean 15.41 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 1179 m in 76.5 s sim (mean 15.41 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/right+2** 1179 m in 76.6 s sim (mean 15.42 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MINOR | unguarded-step | 98–106 | [1308.9, 23.1, 1095.3] | 0.72 m drop | static | left edge: 0.72 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 220–230 | [1178.4, 23.6, 1096.1] | 0.82 m drop | static | left edge: 0.82 m step off at 5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 220–228 | [1184.3, 23.9, 1097.2] | 0.66 m drop | static | right edge: 0.66 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | grade | 636–734 | [974.5, 39.2, 733.4] | 11.6 % max | static | 98 m over 8 % (max 11.6 % per 10 m) |
| MINOR | grade | 948–984 | [951.1, 44.1, 489] | 9.29 % max | static | 36 m over 8 % (max 9.3 % per 10 m) |
| MINOR | scenery | 980 | [946.4, 45.2, 477.9] | 5 m from centre | static | retainingWall/wall yearWalk.retaining.scholars@hollow within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | scenery | 980 | [946.4, 45.2, 477.9] | 5 m from centre | static | retainingWall/wall yearWalk.retaining.hollow@hollow within 1 m of it (5 m from centre, lowest face 0.3 m above the deck) |
| MINOR | buried | 1166 | [912.7, 48.6, 297.5] | 0.077 m terrain above deck | static | visible terrain 0.077 m above the deck inside the carriageway over 2 m |

## VBS — 5 m bed, 334.3 m

Drives: **fwd/centre** 333 m in 23.3 s sim (mean 14.27 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 333 m in 23.3 s sim (mean 14.28 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 6.5 | [954.7, 29.6, 867.9] | -0.173 m step | static | junction cross.vBS.yearWalk.1 (VBS × yearWalk): 1 lips > 0.08 m; worst on other- at 5.65 m: step down 0.17 m walk bight.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside |
| MAJOR | junction-lip | 9.5 | [951.7, 29.6, 869] | -0.28 m step | static (2×) | junction cross.vBS.yearWalk.2 (VBS × yearWalk): 2 lips > 0.08 m; worst on other- at 5.65 m: step down 0.28 m walk bight.bed.lakeside@lakeside → yearWalk.bed.lakeside@lakeside |
| MAJOR | transition | 110.5 | [872.1, 21.3, 939.1] | 0.172 m step | static | structure.bightSpurTrestle end: structure bed 22.09 vs road bed 22.08 (Δ 0.01 m, plan offset 0.22 m); 1 lips > 0.08 m within ±15 m, worst on line 3 m at 13.6 m: step up 0.17 m terrain → S4.surface.1.bight@bight |
| MAJOR | junction-lip | 130 | [872.1, 21.3, 939.1] | 0.172 m step | static | junction cross.s4.vBS.1 (VBS × S4): 1 lips > 0.08 m; worst on road+3 at -5.9 m: step up 0.17 m terrain → S4.surface.1.bight@bight |
| MAJOR | junction-lip | 163.5 | [854.3, 20.1, 969.8] | 0.161 m step | static (2×) | junction cross.vBS.yearWalk.5 (VBS × yearWalk): 2 lips > 0.08 m; worst on road+3 at -3.9 m: step up 0.16 m terrain → yearWalk.shoulders.bight@bight |
| MINOR | grade | 22–52 | [930.2, 28.5, 871.6] | 10.74 % max | static | 30 m over 8 % (max 10.7 % per 10 m) |
| MINOR | verge-drop | 24 | [937.6, 29.2, 868.6] | 1.26 m drop | static | right: 1.26 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | transition | 37 | [920.6, 22.6, 872.5] | -0.089 m step | static | structure.bightSpurTrestle start: structure bed 27.99 vs road bed 27.97 (Δ 0.02 m, plan offset 0.17 m); 46 lips > 0.08 m within ±15 m, worst on line 3 m at 4.1 m: step down 0.09 m terrain → terrain |
| MINOR | junction-lip | 41 | [920.6, 22.6, 872.5] | -0.089 m step | static (43×) | junction cross.vBS.structureBightSpurTrestleMeeting.1 (VBS × structure.bightSpurTrestle.meeting): 43 lips > 0.08 m; worst on road+3 at 0.1 m: step down 0.09 m terrain → terrain |
| MINOR | transition | 41 | [920.6, 22.6, 872.5] | -0.089 m step | static | structure.bightSpurTrestle.meeting start: structure bed 27.56 vs road bed 27.54 (Δ 0.02 m, plan offset 0.17 m); 46 lips > 0.08 m within ±15 m, worst on line 3 m at 0.1 m: step down 0.09 m terrain → terrain |
| MINOR | transition | 41 | [920.6, 22.6, 872.5] | -0.089 m step | static | structure.bightSpurTrestle.meeting end: structure bed 27.56 vs road bed 27.54 (Δ 0.02 m, plan offset 5.25 m); 46 lips > 0.08 m within ±15 m, worst on line 3 m at 0.1 m: step down 0.09 m terrain → terrain |
| MINOR | verge-drop | 42–44 | [919.2, 27.3, 876.5] | 1.39 m drop | static | left: 1.39 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 54–62 | [910.4, 26.5, 881.1] | 8.65 m drop | static | left: 8.65 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | grade | 54–94 | [904.1, 25.8, 886] | 8.57 % max | static | 40 m over 8 % (max 8.6 % per 10 m) |
| MINOR | verge-drop | 66–68 | [900.3, 25.3, 890.7] | 7.62 m drop | static | left: 7.62 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | verge-drop | 92 | [888.8, 23.3, 911.7] | 2.04 m drop | static | left: 2.04 m drop 5.5 m from centre (beyond the 2.5 m edge + 1.5 m verge; no guard needed by the bake rule) |
| MINOR | lip | 138.7 | [865.8, 20.7, 952.3] | -0.097 m step | static | step down 0.10 m plot.bight.1.service.corridor.deck.1.bight@bight → VBS.corridor.deck.2.bight@bight on lines 1.88 m |
| MINOR | pad-lip | 207 | [833.4, 18.7, 1005.9] | -0.219 m step | static | pad plot.bight.2.layby (landing, top 18.72 vs road bed 18.71): 1 lips between the road and 4 m inside the pad; worst 2.5 m out from the road centre: crack 0.22 m deep, 0.2 m wide between prisms (VBS.corridor.deck.2.bight@bight \| terrain showing) |

## V03 — 8 m bed, 327.4 m

Drives: **fwd/centre** 326 m in 22.5 s sim (mean 14.48 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 326 m in 22.5 s sim (mean 14.48 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 326 m in 22.5 s sim (mean 14.47 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/right+2** 326 m in 22.5 s sim (mean 14.48 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 327 | [1278.4, 55.1, 750.7] | -0.206 m step | static | junction cross.v03.walkFootQuay.1 (V03 × walk footQuay): 1 lips > 0.08 m; worst on other+ at 9.21 m: step down 0.21 m yearWalk.shoulders.lakeside@lakeside → walk footQuay.bed.lakeside@lakeside |
| MINOR | buried | 4–6 | [1593.5, 35.1, 787.4] | 0.149 m terrain above deck | static | visible terrain 0.149 m above the deck inside the carriageway over 4 m |
| MINOR | unguarded-step | 8–10 | [1589.5, 35.1, 790.9] | 0.8 m drop | static | left edge: 0.8 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | grade | 22–46 | [1571.5, 36, 791] | 9.52 % max | static | 24 m over 8 % (max 9.5 % per 10 m) |
| MINOR | grade | 44–212 | [1409.5, 51.9, 789.1] | 10.02 % max | static | 168 m over 8 % (max 10 % per 10 m) |
| MINOR | unguarded-step | 230–238 | [1370.8, 54.5, 780.4] | 0.64 m drop | static | right edge: 0.64 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 284–288 | [1318.1, 55.5, 756.4] | 0.9 m drop | static | right edge: 0.9 m step off at 5.25 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 318 | [1290.5, 55.7, 744.5] | 0.52 m drop | static | right edge: 0.52 m step off at 5 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## spur upperStreet — 5 m bed, 20 m

Drives: **fwd/centre** 18.5 m in 2.8 s sim (mean 6.54 m/s, max 11), 0 contact steps, 0 airborne steps · **rev/centre** 18.5 m in 2.8 s sim (mean 6.54 m/s, max 11), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 20 | [1482.5, 17.3, 1066.4] | -0.304 m step | static | junction cross.s3.spurUpperStreet.1 (spur upperStreet × S3): 1 lips > 0.08 m; worst on other+ at 6.83 m: step down 0.30 m walk square.bed.harbour@harbour → S3.surface.0.harbour@harbour |
| MAJOR | pad-lip | 20 | [1477.3, 18.1, 1046.4] | -0.248 m step | static | pad town.upperStreet (place, top 18 vs road bed 18): 1 lips between the road and 4 m inside the pad; worst 6.9 m out from the road centre: step down 0.25 m V01.corridor.deck.3.harbour@harbour → terrain |

## spur library — 5 m bed, 156.5 m

Drives: **fwd/centre** 155.5 m in 11.7 s sim (mean 13.26 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 155.5 m in 11.7 s sim (mean 13.26 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 105 | [799.7, 45.9, 336.8] | -0.323 m step | static (4×) | junction cross.spurLibrary.yearWalk.1 (spur library × yearWalk): 4 lips > 0.08 m; worst on road+3 at 5.7 m: step down 0.32 m yearWalk.shoulders.scholars@scholars → terrain |
| MAJOR | pad-lip | 112.5 | [798.2, 45.9, 338.1] | -0.375 m step | static (4×) | pad station.oct (station, top 45.5 vs road bed 46.23): 4 lips between the road and 4 m inside the pad; worst 2.5 m out from the road centre: step down 0.38 m spur library.corridor.deck.1.scholars@scholars → terrain |
| MAJOR | junction-lip | 156.5 | [761.6, 47.6, 362.5] | -0.273 m step | static (3×) | junction cross.spurLibrary.walkCoveWalk.1 (spur library × walk coveWalk): 3 lips > 0.08 m; worst on road-3 at -0.3 m: step down 0.27 m walk coveWalk.bed.scholars@scholars → terrain |
| MINOR | unguarded-step | 116 | [796.3, 46.3, 341.9] | 0.51 m drop | static | right edge: 0.51 m step off at 2.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## spur glasshouse — 5 m bed, 50 m

Drives: **fwd/centre** 49 m in 5.1 s sim (mean 9.65 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 49 m in 5.1 s sim (mean 9.65 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | grade | 16–50 | [982.4, 31.4, 843.2] | 12 % max | static | 34 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum |
| MAJOR | scenery | 44 | [995.2, 33.3, 833.6] | 2.5 m from centre | static | retainingWall/wall walk glasshouseSteps.retaining.lakeside@lakeside inside the carriageway (2.5 m from centre, lowest face 0.3 m above the deck) |

## spur studio — 5 m bed, 26 m

Drives: **fwd/centre** 24.5 m in 3.3 s sim (mean 7.35 m/s, max 12.4), 0 contact steps, 0 airborne steps · **rev/centre** 24.5 m in 3.3 s sim (mean 7.35 m/s, max 12.4), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 26 | [999, 40, 543] | 0.362 m step | static (2×) | junction cross.hostStudioApproach.spurStudio.1 (spur studio × host.studio.approach): 2 lips > 0.08 m; worst on road+3 at -1 m: step up 0.36 m terrain → host.studio.apron.slab@hollow |

## spur cottage — 5 m bed, 70.7 m

Drives: **fwd/centre** 69.5 m in 6.3 s sim (mean 10.93 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 69.5 m in 6.3 s sim (mean 10.93 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 70.5 | [931.1, 38.4, 655.4] | 0.31 m step | static (2×) | junction cross.spurCottage.walkGarden.1 (spur cottage × walk garden): 2 lips > 0.08 m; worst on road-3 at -4.4 m: step up 0.31 m terrain → walk garden.bed.hollow@hollow |
| MINOR | junction-lip | 8 | [967.9, 42, 692.2] | -0.099 m step | static | junction cross.spurCottage.yearWalk.1 (spur cottage × yearWalk): 1 lips > 0.08 m; worst on road-3 at 6.1 m: step down 0.10 m yearWalk.shoulders.hollow@hollow → terrain |
| MINOR | junction-lip | 11.5 | [967.9, 42, 692.2] | -0.099 m step | static | junction cross.spurCottage.yearWalk.2 (spur cottage × yearWalk): 1 lips > 0.08 m; worst on road-3 at 2.6 m: step down 0.10 m yearWalk.shoulders.hollow@hollow → terrain |
| MINOR | unguarded-step | 28 | [960.2, 41.8, 680.2] | 0.73 m drop | static | left edge: 0.73 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | grade | 32–66 | [948.9, 40.5, 668.9] | 11.61 % max | static | 34 m over 8 % (max 11.6 % per 10 m) |
| MINOR | unguarded-step | 36 | [954.5, 41.2, 674.5] | 0.71 m drop | static | left edge: 0.71 m step off at 3 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 36 | [954.5, 41.2, 674.5] | 0.71 m drop | static | right edge: 0.71 m step off at 3 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 42 | [950.3, 40.7, 670.3] | 0.7 m drop | static | left edge: 0.7 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 42 | [950.3, 40.7, 670.3] | 0.7 m drop | static | right edge: 0.7 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 50 | [944.6, 39.8, 664.6] | 0.79 m drop | static | left edge: 0.79 m step off at 2.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 50 | [944.6, 39.8, 664.6] | 0.79 m drop | static | right edge: 0.79 m step off at 2.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 56–58 | [940.4, 39.1, 660.4] | 0.75 m drop | static | right edge: 0.75 m step off at 2.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |
| MINOR | unguarded-step | 64 | [934.8, 38.4, 654.8] | 0.71 m drop | static | right edge: 0.71 m step off at 2.5 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## spur boathouse — 5 m bed, 36.4 m

Drives: **fwd/centre** 35 m in 4.2 s sim (mean 8.35 m/s, max 14.7), 0 contact steps, 0 airborne steps · **rev/centre** 35 m in 4.2 s sim (mean 8.35 m/s, max 14.7), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | grade | 4–36 | [1297.3, 7.8, 1370.4] | 12.01 % max | static | 32 m over 8 % (max 12 % per 10 m) — over the 12 % profile maximum |

## plot.terraces.1.service — 5 m bed, 27.7 m

Drives: **fwd/centre** 26.5 m in 3.8 s sim (mean 6.61 m/s, max 11.5), 0 contact steps, 0 airborne steps · **rev/centre** 26.5 m in 3.9 s sim (mean 6.5 m/s, max 11.6), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 2.5 | [1589.9, 32, 828.5] | -0.171 m step | static (3×) | junction cross.plotTerraces1Service.yearWalk.1 (plot.terraces.1.service × yearWalk): 3 lips > 0.08 m; worst on road+3 at 3.2 m: step down 0.17 m yearWalk.shoulders.prow@prow → terrain |
| MINOR | lip | 6 | [1589.9, 31.9, 829.7] | -0.121 m step | static | step down 0.12 m yearWalk.shoulders.prow@prow → plot.terraces.1.service.corridor.deck.1.prow@prow on lines 1.88 m |
| MINOR | unguarded-step | 14 | [1583.9, 31.9, 835.8] | 0.6 m drop | static | left edge: 0.6 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## plot.terraces.2.service — 5 m bed, 62.5 m

Drives: **fwd/centre** 61.5 m in 6 s sim (mean 9.7 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 61 m in 6.4 s sim (mean 9.23 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 2 | [1573.8, 25.2, 910.6] | -0.173 m step | static (4×) | junction cross.plotTerraces2Service.yearWalk.1 (plot.terraces.2.service × yearWalk): 4 lips > 0.08 m; worst on road+3 at 5.1 m: step down 0.17 m yearWalk.shoulders.prow@prow → terrain |
| MINOR | buried | 0 | [1577.3, 25.4, 913.4] | 0.06 m terrain above deck | static | visible terrain 0.06 m above the deck inside the carriageway over 2 m |
| MINOR | scenery | 4 | [1574.3, 25.3, 914.6] | 3.5 m from centre | static | column/support prowTunnel.colonnade@prow within 1 m of it (3.5 m from centre, lowest face 0.3 m above the deck) |

## plot.terraces.3.service — 5 m bed, 55.7 m

Drives: **fwd/centre** 55 m in 5.6 s sim (mean 9.11 m/s, max 15.8), 0 contact steps, 0 airborne steps · **rev/centre** 54.5 m in 6 s sim (mean 8.72 m/s, max 15.7), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 2 | [1549.3, 20.6, 966.4] | -0.309 m step | static (2×) | junction cross.plotTerraces3Service.yearWalk.1 (plot.terraces.3.service × yearWalk): 2 lips > 0.08 m; worst on road+3 at 3.6 m: step down 0.31 m plot.terraces.3.layby.slab@prow → terrain |
| MINOR | buried | 2 | [1553.6, 20.8, 968.5] | 0.1 m terrain above deck | static | visible terrain 0.1 m above the deck inside the carriageway over 2 m |
| MINOR | lip | 5.9 | [1548.8, 20.7, 967.4] | -0.142 m step | static | step down 0.14 m plot.terraces.3.layby.slab@prow → plot.terraces.3.service.corridor.deck.1.prow@prow on lines 1.88 m |

## plot.bight.1.service — 5 m bed, 67.2 m

Drives: **fwd/centre** 66 m in 6.2 s sim (mean 10.07 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 66.5 m in 6.7 s sim (mean 9.63 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | junction-lip | 17.5 | [854.3, 20.2, 931.3] | -0.434 m step | static (5×) | junction cross.plotBight1Service.yearWalk.1 (plot.bight.1.service × yearWalk): 5 lips > 0.08 m; worst on road+3 at 5.9 m: step down 0.43 m yearWalk.shoulders.bight@bight → terrain |
| MINOR | lip | 7.4 | [862.4, 20.8, 944.9] | -0.086 m step | static | step down 0.09 m plot.bight.1.layby.slab@bight → plot.bight.1.service.corridor.deck.1.bight@bight on lines 1.88 m |
| MINOR | unguarded-step | 24–30 | [851.5, 20.8, 932.5] | 0.7 m drop | static | right edge: 0.7 m step off at 2.75 m (launches the cruiser if it drifts out: groundSnap 0.55) |

## plot.bight.2.service — 5 m bed, 73.5 m

Drives: **fwd/centre** 72.5 m in 6.6 s sim (mean 10.43 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 73 m in 7 s sim (mean 10.06 m/s, max 16), 0 contact steps, 0 airborne steps

No issues.

## plot.bight.3.service — 5 m bed, 83.3 m

Drives: **fwd/centre** 82 m in 7.2 s sim (mean 10.95 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 83 m in 7.7 s sim (mean 10.43 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MINOR | buried | 2 | [797.7, 16.1, 1062.8] | 0.061 m terrain above deck | static | visible terrain 0.061 m above the deck inside the carriageway over 2 m |
| MINOR | lip | 6.8 | [792.3, 16, 1061.3] | -0.081 m step | static | step down 0.08 m plot.bight.3.layby.slab@bight → plot.bight.3.service.corridor.deck.1.bight@bight on lines 1.88 m |

## plot.bight.4.service — 5 m bed, 77.9 m

Drives: **fwd/centre** 76.5 m in 7.1 s sim (mean 10.35 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 77 m in 7.4 s sim (mean 10.02 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MINOR | seam | 1.5–2.9 | [771.2, 14, 1123.9] | 0.102 m step | static | ridge 0.10 m high, 0.3 m wide between prisms (terrain \| plot.bight.4.service.corridor.deck.1.bight@bight showing) on lines -1.87 m |
| MINOR | pad-lip | 4.5 | [769.9, 13.9, 1124.8] | -0.098 m step | static | pad plot.bight.4.layby (landing, top 14 vs road bed 14): 1 lips between the road and 4 m inside the pad; worst 2.6 m out from the road centre: step down 0.10 m plot.bight.4.service.corridor.deck.1.bight@bight → terrain |

## Bight Bridge frame vs V01 spline

Straight frame [[460.68,12,1028.28],[661.39,12,1168.77]] (deck 21.6 m); V01 half-width + shoulder 5 m. Max lateral offset of the V01 centreline from the frame: **1.8 m** at station 2575.5.

| V01 station | t on frame | lateral m | heading Δ° |
|---:|---:|---:|---:|
| 2575 | 0 | 1.79 | 1.3 |
| 2580 | 0.021 | 1.8 | 0 |
| 2585 | 0.041 | 1.8 | 0 |
| 2590 | 0.061 | 1.8 | 0 |
| 2595 | 0.082 | 1.8 | 0 |
| 2600 | 0.102 | 1.8 | 0 |
| 2605 | 0.123 | 1.8 | 0 |
| 2610 | 0.143 | 1.8 | 0 |
| 2615 | 0.164 | 1.8 | 0 |
| 2620 | 0.184 | 1.8 | 0 |
| 2625 | 0.204 | 1.8 | 0 |
| 2630 | 0.225 | 1.8 | 0 |
| 2635 | 0.245 | 1.8 | 0 |
| 2640 | 0.266 | 1.8 | 0 |
| 2645 | 0.286 | 1.8 | 0 |
| 2650 | 0.306 | 1.8 | 0 |
| 2655 | 0.327 | 1.8 | 0 |
| 2660 | 0.347 | 1.8 | 0 |
| 2665 | 0.368 | 1.8 | 0 |
| 2670 | 0.388 | 1.8 | 0 |
| 2675 | 0.408 | 1.8 | 0 |
| 2680 | 0.429 | 1.8 | 0 |
| 2685 | 0.449 | 1.8 | 0 |
| 2690 | 0.47 | 1.8 | 0 |
| 2695 | 0.49 | 1.8 | 0 |
| 2700 | 0.51 | 1.8 | 0 |
| 2705 | 0.531 | 1.8 | 0 |
| 2710 | 0.551 | 1.8 | 0 |
| 2715 | 0.572 | 1.8 | 0 |
| 2720 | 0.592 | 1.8 | 0 |
| 2725 | 0.612 | 1.8 | 0 |
| 2730 | 0.633 | 1.8 | 0 |
| 2735 | 0.653 | 1.8 | 0 |
| 2740 | 0.674 | 1.8 | 0 |
| 2745 | 0.694 | 1.8 | 0 |
| 2750 | 0.715 | 1.8 | 0 |
| 2755 | 0.735 | 1.8 | 0 |
| 2760 | 0.755 | 1.8 | 0 |
| 2765 | 0.776 | 1.8 | 0 |
| 2770 | 0.796 | 1.8 | 0 |
| 2775 | 0.817 | 1.8 | 0 |
| 2780 | 0.837 | 1.8 | 0 |
| 2785 | 0.857 | 1.8 | 0 |
| 2790 | 0.878 | 1.8 | 0 |
| 2795 | 0.898 | 1.8 | 0 |
| 2800 | 0.919 | 1.8 | 0 |
| 2805 | 0.939 | 1.8 | 0 |
| 2810 | 0.959 | 1.8 | 0 |
| 2815 | 0.98 | 1.8 | 0 |

## Structure transitions

| Structure | End | Road | Station | Structure bed y | Road bed y | Δ | Lips > 0.08 (±15 m, 5 lines) | Worst |
|---|---|---|---:|---:|---:|---:|---:|---|
| structure.highSpan | start | VG | 115.5 | 24 | 23.96 | 0.04 | 0 | — |
| structure.highSpan | end | VG | 219.5 | 24 | 23.98 | 0.02 | 0 | — |
| structure.quayBridge | start | V01 | 3550 | 9 | 8.99 | 0.01 | 0 | — |
| structure.quayBridge | end | V01 | 3640 | 9 | 9 | 0 | 0 | — |
| structure.bightBridge.towerStair.approach | start | V01 | 2702.5 | 12 | 12 | 0 | 0 | — |
| structure.bightBridge.s2Ramp.lagoon | start | V01 | 2605.5 | 12 | 12 | 0 | 0 | — |
| structure.bightBridge.s2Ramp.lagoon | end | V01 | 2675.5 | 17.6 | 12 | 5.6 | 0 | — |
| structure.bightBridge.s2Ramp.sea | start | V01 | 2707.5 | 17.6 | 12 | 5.6 | 0 | — |
| structure.bightBridge.s2Ramp.sea | end | V01 | 2777.5 | 12 | 12 | 0 | 0 | — |
| structure.bightBridge.s2Flyover | start | V01 | 2675.5 | 17.6 | 12 | 5.6 | 0 | — |
| structure.bightBridge.s2Flyover | end | V01 | 2707.5 | 17.6 | 12 | 5.6 | 0 | — |
| structure.bightBridge | start | V01 | 2575 | 12 | 12 | 0 | 0 | — |
| structure.bightBridge | end | V01 | 2820 | 12 | 11.99 | 0.01 | 0 | — |
| structure.mountainRoadCanalBridge | start | V03 | 298.5 | 55.9 | 55.9 | 0 | 0 | — |
| structure.mountainRoadCanalBridge | end | V03 | 316.5 | 55.77 | 55.77 | 0 | 0 | — |
| prowTunnel | start | V01 | 234.5 | 24.11 | 24.1 | 0 | 0 | — |
| prowTunnel | end | V01 | 324.5 | 30.82 | 30.82 | 0 | 0 | — |
| structure.bightSpurTrestle | start | VBS | 37 | 27.99 | 27.97 | 0.02 | 46 | MINOR: step down 0.09 m terrain → terrain @ [920.6, 22.6, 872.5] |
| structure.bightSpurTrestle | end | VBS | 110.5 | 22.09 | 22.08 | 0.01 | 1 | MAJOR: step up 0.17 m terrain → S4.surface.1.bight@bight @ [872.1, 21.3, 939.1] |
| structure.highSpan.meeting | start | VG | 119.5 | 24 | 24 | 0 | 0 | — |
| structure.highSpan.meeting | end | VG | 119.5 | 24 | 24 | 0 | 0 | — |
| structure.quayBridge.meeting | start | V01 | 3554 | 9 | 9 | 0 | 0 | — |
| structure.quayBridge.meeting | end | V01 | 3554 | 9 | 9 | 0 | 0 | — |
| structure.mountainRoadCanalBridge.meeting | start | V03 | 302.5 | 55.97 | 55.97 | 0 | 0 | — |
| structure.mountainRoadCanalBridge.meeting | end | V03 | 302.5 | 55.97 | 55.97 | 0 | 0 | — |
| structure.prowLoopFootbridge.meeting | end | V01 | 490 | 45.95 | 43.14 | 2.81 | 0 | — |
| structure.bightSpurTrestle.meeting | start | VBS | 41 | 27.56 | 27.54 | 0.02 | 46 | MINOR: step down 0.09 m terrain → terrain @ [920.6, 22.6, 872.5] |
| structure.bightSpurTrestle.meeting | end | VBS | 41 | 27.56 | 27.54 | 0.02 | 46 | MINOR: step down 0.09 m terrain → terrain @ [920.6, 22.6, 872.5] |

## Junctions (threshold crossings)

| Crossing | Road | Other | Station | Lips > 0.08 | Worst |
|---|---|---|---:|---:|---|
| cross.s3.v01.3 | V01 | S3 | 3555 | 0 | — |
| cross.s3.v01.1 | V01 | S3 | 3595 | 0 | — |
| cross.hostBoathouseApproach.spurBoathouse.1 | spur boathouse | host.boathouse.approach | 36 | 0 | — |
| cross.spurCottage.walkGarden.1 | spur cottage | walk garden | 70.5 | 2 | MAJOR: step up 0.31 m terrain → walk garden.bed.hollow@hollow on road-3 @ [931.1, 38.4, 655.4] |
| cross.spurCottage.yearWalk.2 | spur cottage | yearWalk | 11.5 | 1 | MINOR: step down 0.10 m yearWalk.shoulders.hollow@hollow → terrain on road-3 @ [967.9, 42, 692.2] |
| cross.spurCottage.yearWalk.1 | spur cottage | yearWalk | 8 | 1 | MINOR: step down 0.10 m yearWalk.shoulders.hollow@hollow → terrain on road-3 @ [967.9, 42, 692.2] |
| cross.spurLibrary.walkCoveWalk.1 | spur library | walk coveWalk | 156.5 | 3 | MAJOR: step down 0.27 m walk coveWalk.bed.scholars@scholars → terrain on road-3 @ [761.6, 47.6, 362.5] |
| cross.spurLibrary.yearWalk.1 | spur library | yearWalk | 105 | 4 | MAJOR: step down 0.32 m yearWalk.shoulders.scholars@scholars → terrain on road+3 @ [799.7, 45.9, 336.8] |
| cross.hostStudioApproach.spurStudio.1 | spur studio | host.studio.approach | 26 | 2 | MAJOR: step up 0.36 m terrain → host.studio.apron.slab@hollow on road+3 @ [999, 40, 543] |
| cross.s3.spurUpperStreet.1 | spur upperStreet | S3 | 20 | 1 | MAJOR: step down 0.30 m walk square.bed.harbour@harbour → S3.surface.0.harbour@harbour on other+ @ [1482.5, 17.3, 1066.4] |
| cross.spurUpperStreet.walkSquare.1 | spur upperStreet | walk square | 20 | 0 | — |
| cross.s3.v01.4 | V01 | S3 | 3555 | 0 | — |
| cross.s3.v01.2 | V01 | S3 | 3595 | 0 | — |
| cross.v01.spurBoathouse.1 | V01 | spur boathouse | 3532 | 0 | — |
| cross.v01.spurLibrary.1 | V01 | spur library | 1444 | 1 | MINOR: step up 0.09 m V01.corridor.deck.1.scholars@scholars → spur library.corridor.deck.1.scholars@scholars on road-3 @ [899.3, 48.1, 293.1] |
| cross.v01.spurUpperStreet.1 | V01 | spur upperStreet | 82.5 | 0 | — |
| cross.v01.structureQuayBridgeMeeting.1 | V01 | structure.quayBridge.meeting | 3554 | 0 | — |
| cross.v01.townNorthLink.1 | V01 | town.northLink | 3819 | 0 | — |
| cross.v01.townRiverLink.1 | V01 | town.riverLink | 3682.5 | 0 | — |
| cross.v01.v03.1 | V01 | V03 | 380 | 0 | — |
| cross.v01.vG.1 | V01 | VG | 1444 | 1 | MINOR: step up 0.09 m V01.corridor.deck.1.scholars@scholars → spur library.corridor.deck.1.scholars@scholars on road-3 @ [899.3, 48.1, 293.1] |
| cross.v01.vG.2 | V01 | VG | 0 | 0 | — |
| cross.v01.walkBightPier.1 | V01 | walk bightPier | 2424 | 1 | MAJOR: step up 0.16 m walk bightPier.bed.flats@flats → yearWalk.shoulders.flats@flats on other+ @ [411.8, 24.5, 896.5] |
| cross.v01.walkCoveWalk.1 | V01 | walk coveWalk | 1664 | 1 | MINOR: step down 0.14 m V01.corridor.deck.1.scholars@scholars → walk coveWalk.bed.scholars@scholars on other+ @ [678.5, 41.4, 306.3] |
| cross.v01.walkReach.1 | V01 | walk reach | 3670 | 1 | MINOR: step down 0.11 m V01.corridor.walk.R.5.reach@reach → walk reach.bed.reach@reach on other- @ [1375.7, 8.7, 1276.6] |
| cross.v01.yearWalk.5 | V01 | yearWalk | 2628 | 0 | — |
| cross.v01.yearWalk.6 | V01 | yearWalk | 2661.5 | 0 | — |
| cross.v01.yearWalk.7 | V01 | yearWalk | 2943 | 0 | — |
| cross.v01.yearWalk.4 | V01 | yearWalk | 1533.5 | 0 | — |
| cross.v01.yearWalk.8 | V01 | yearWalk | 3181.5 | 0 | — |
| cross.v01.yearWalk.3 | V01 | yearWalk | 1010.5 | 0 | — |
| cross.v01.yearWalk.1 | V01 | yearWalk | 118 | 1 | MAJOR: step down 0.53 m yearWalk.shoulders.harbour@harbour → yearWalk.bed.harbour@harbour on other- @ [1518.2, 16.5, 1034.8] |
| cross.v01.yearWalk.2 | V01 | yearWalk | 506 | 0 | — |
| cross.v03.structureMountainRoadCanalBridgeMeeting.1 | V03 | structure.mountainRoadCanalBridge.meeting | 302.5 | 0 | — |
| cross.v03.walkFootQuay.1 | V03 | walk footQuay | 327 | 1 | MAJOR: step down 0.21 m yearWalk.shoulders.lakeside@lakeside → walk footQuay.bed.lakeside@lakeside on other+ @ [1278.4, 55.1, 750.7] |
| cross.v03.yearWalk.1 | V03 | yearWalk | 326.5 | 0 | — |
| cross.s4.vBS.1 | VBS | S4 | 130 | 1 | MAJOR: step up 0.17 m terrain → S4.surface.1.bight@bight on road+3 @ [872.1, 21.3, 939.1] |
| cross.vBS.spurGlasshouse.1 | VBS | spur glasshouse | 0 | 0 | — |
| cross.vBS.structureBightSpurTrestleMeeting.1 | VBS | structure.bightSpurTrestle.meeting | 41 | 43 | MINOR: step down 0.09 m terrain → terrain on road+3 @ [920.6, 22.6, 872.5] |
| cross.vBS.yearWalk.5 | VBS | yearWalk | 163.5 | 2 | MAJOR: step up 0.16 m terrain → yearWalk.shoulders.bight@bight on road+3 @ [854.3, 20.1, 969.8] |
| cross.vBS.yearWalk.2 | VBS | yearWalk | 9.5 | 2 | MAJOR: step down 0.28 m walk bight.bed.lakeside@lakeside → yearWalk.bed.lakeside@lakeside on other- @ [951.7, 29.6, 869] |
| cross.vBS.yearWalk.1 | VBS | yearWalk | 6.5 | 1 | MAJOR: step down 0.17 m walk bight.bed.lakeside@lakeside → yearWalk.shoulders.lakeside@lakeside on other- @ [954.7, 29.6, 867.9] |
| cross.s4.vG.1 | VG | S4 | 915 | 0 | — |
| cross.vG.spurCottage.1 | VG | spur cottage | 744 | 0 | — |
| cross.vG.spurGlasshouse.1 | VG | spur glasshouse | 582.5 | 0 | — |
| cross.vG.spurLibrary.1 | VG | spur library | 1180 | 0 | — |
| cross.vG.spurStudio.1 | VG | spur studio | 911.5 | 0 | — |
| cross.vG.structureHighSpanMeeting.1 | VG | structure.highSpan.meeting | 119.5 | 0 | — |
| cross.vBS.vG.1 | VG | VBS | 582.5 | 0 | — |
| cross.vG.walkBight.1 | VG | walk bight | 578 | 0 | — |
| cross.vG.yearWalk.3 | VG | yearWalk | 983.5 | 0 | — |
| cross.vG.yearWalk.2 | VG | yearWalk | 848 | 0 | — |
| cross.vG.yearWalk.1 | VG | yearWalk | 836 | 0 | — |
| cross.plotBight1Service.yearWalk.1 | plot.bight.1.service | yearWalk | 17.5 | 5 | MAJOR: step down 0.43 m yearWalk.shoulders.bight@bight → terrain on road+3 @ [854.3, 20.2, 931.3] |
| cross.plotTerraces1Service.yearWalk.1 | plot.terraces.1.service | yearWalk | 2.5 | 3 | MAJOR: step down 0.17 m yearWalk.shoulders.prow@prow → terrain on road+3 @ [1589.9, 32, 828.5] |
| cross.plotTerraces2Service.yearWalk.1 | plot.terraces.2.service | yearWalk | 2 | 4 | MAJOR: step down 0.17 m yearWalk.shoulders.prow@prow → terrain on road+3 @ [1573.8, 25.2, 910.6] |
| cross.plotTerraces3Service.yearWalk.1 | plot.terraces.3.service | yearWalk | 2 | 2 | MAJOR: step down 0.31 m plot.terraces.3.layby.slab@prow → terrain on road+3 @ [1549.3, 20.6, 966.4] |

## Pads touching a road

| Pad | Kind | Road | Station | Pad top | Road bed | Lips | Worst |
|---|---|---|---:|---:|---:|---:|---|
| station.oct | station | spur library | 112.5 | 45.5 | 46.23 | 4 | MAJOR: step down 0.38 m spur library.corridor.deck.1.scholars@scholars → terrain @ [798.2, 45.9, 338.1] |
| town.upperStreet | place | V01 | 64 | 18 | 19.63 | 0 | — |
| town.upperStreet | place | spur upperStreet | 20 | 18 | 18 | 1 | MAJOR: step down 0.25 m V01.corridor.deck.3.harbour@harbour → terrain @ [1477.3, 18.1, 1046.4] |
| tidelinePark | place | V01 | 3256.5 | 3 | 5.34 | 9 | MAJOR: step down 0.48 m V01.corridor.kerb.R.5.landing@landing → terrain @ [1025.6, 5, 1396.1] |
| plot.terraces.1 | reserve | plot.terraces.1.service | 27.5 | 31.93 | 31.93 | 0 | — |
| plot.terraces.1.apron | landing | plot.terraces.1.service | 24.5 | 31.93 | 31.93 | 0 | — |
| plot.terraces.1.layby | landing | V01 | 339.5 | 31.93 | 31.94 | 0 | — |
| plot.terraces.1.layby | landing | plot.terraces.1.service | 3 | 31.93 | 31.93 | 0 | — |
| plot.terraces.2 | reserve | plot.terraces.2.service | 48 | 25.31 | 25.31 | 0 | — |
| plot.terraces.2.apron | landing | plot.terraces.2.service | 59.5 | 25.31 | 25.31 | 0 | — |
| plot.terraces.2.layby | landing | V01 | 250.5 | 25.31 | 25.3 | 0 | — |
| plot.terraces.2.layby | landing | plot.terraces.2.service | 3.5 | 25.31 | 25.31 | 0 | — |
| plot.terraces.3 | reserve | plot.terraces.3.service | 40 | 20.7 | 20.7 | 0 | — |
| plot.terraces.3.apron | landing | plot.terraces.3.service | 52.5 | 20.7 | 20.7 | 0 | — |
| plot.terraces.3.layby | landing | V01 | 189 | 20.7 | 20.71 | 0 | — |
| plot.terraces.3.layby | landing | plot.terraces.3.service | 3.5 | 20.7 | 20.7 | 0 | — |
| plot.bight.1 | reserve | plot.bight.1.service | 67 | 20.8 | 20.8 | 0 | — |
| plot.bight.1.apron | landing | plot.bight.1.service | 64 | 20.8 | 20.8 | 0 | — |
| plot.bight.1.layby | landing | VBS | 136 | 20.8 | 20.8 | 0 | — |
| plot.bight.1.layby | landing | plot.bight.1.service | 3.5 | 20.8 | 20.8 | 0 | — |
| plot.bight.2 | reserve | plot.bight.2.service | 73.5 | 18.72 | 18.72 | 0 | — |
| plot.bight.2.apron | landing | plot.bight.2.service | 70.5 | 18.72 | 18.72 | 0 | — |
| plot.bight.2.layby | landing | VBS | 207 | 18.72 | 18.71 | 1 | MINOR: crack 0.22 m deep, 0.2 m wide between prisms (VBS.corridor.deck.2.bight@bight \| terrain showing) @ [833.4, 18.7, 1005.9] |
| plot.bight.2.layby | landing | plot.bight.2.service | 4 | 18.72 | 18.72 | 0 | — |
| plot.bight.3 | reserve | plot.bight.3.service | 83 | 15.99 | 15.99 | 0 | — |
| plot.bight.3.apron | landing | plot.bight.3.service | 80.5 | 15.99 | 15.99 | 0 | — |
| plot.bight.3.layby | landing | VBS | 271 | 15.99 | 16.01 | 0 | — |
| plot.bight.3.layby | landing | plot.bight.3.service | 4 | 15.99 | 15.99 | 0 | — |
| plot.bight.4 | reserve | plot.bight.4.service | 77.5 | 14 | 14 | 0 | — |
| plot.bight.4.apron | landing | plot.bight.4.service | 75 | 14 | 14 | 0 | — |
| plot.bight.4.layby | landing | VBS | 334 | 14 | 14 | 0 | — |
| plot.bight.4.layby | landing | plot.bight.4.service | 4.5 | 14 | 14 | 1 | MINOR: step down 0.10 m plot.bight.4.service.corridor.deck.1.bight@bight → terrain @ [769.9, 13.9, 1124.8] |
| host.studio | host | spur studio | 26 | 40 | 40 | 0 | — |
| host.studio.apron | landing | spur studio | 26 | 40 | 40 | 0 | — |

## Limits of this audit

- Board, bicycle and walker bodies are not driven here (their kernels treat 0.10–0.12 m as a wall); only the cruiser.
- Visual-only checks (markings, lighting, texture) are out of scope; `scenery` covers collision solids and v2 planting positions only. Horizon land has no planting of its own in this bake.
- The Mountain v2 provider is registered always-drawn (`provider`), as the ride tests do; at runtime its decks answer only while its scene is drawn.
- The driver is scripted: a human steers differently. Contacts on the +2 m lane on narrow stretches are expected physics, graded by whether the rider was still inside the carriageway.
- Only the cruiser's own collision queries are used; the camera (`cameraBlocked`) and visual pop-in are not audited.
- Debug aids: `--trace <bed>:<fwd|rev>:<0|2>:<from>:<to>` prints every step of one pass in a station window; `--probe-line x0,z0,x1,z1,y` prints the surface every 0.1 m along a line and the lips found.
