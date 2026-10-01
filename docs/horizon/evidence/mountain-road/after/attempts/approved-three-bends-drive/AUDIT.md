# Horizon road audit — before

Driver's-eye audit of the committed bake with the real cruiser sim (`stepCruiser`, CRUISER.dt = 1/120 s). Read-only: nothing under `src/` or `public/` was changed.

- Command: `node scripts/horizon/road-audit.mjs --mountain-chain --no-static --out /tmp/mountain-three-bends-drive` (from the repo root)
- Checkout: `df77030298d5ff960d2eeaa5eb62c8558008694b`; world `public/horizon/world/horizon-geo-1.json.gz` sha256 `def4e4bde244810e…`, terrain sha256 `0dc23c32ca9af9d3…` (horizon-geo-1)
- Wall-clock: **44.1 s** on 8 CPUs (v24.21.0); generated 2026-10-01T05:43:31.343Z
- Roads: mountain-chain

**Scope:** drive enabled; static sweep disabled. The mountain chain shares its source with the bake and varies width at each station. Endpoint completion after restarts is not uninterrupted acceptance.

## Method

- **World**: `parseHorizonDefinition(horizon-geo-1.json.gz)` + `decodeTerrainAsset(bin,'full')` + `createHorizonGeography(field,{...collision, solids, diagnostics})` + `addDynamic(createMountainV2Region(...).provider)` — the loader of `test/horizonRideSituations.test.ts`.
- **Drive**: pure pursuit (lookahead 6–8 m) on the lane line; target speed = min(16, √(4/κ)) braked back at 5 m/s²; throttle/coast/brake only through `stepCruiser` inputs; no snapping. Passes: forward and reverse, centreline and keep-right +2 m (5 m-wide spurs: centreline only). V01 is driven round the whole loop (+10 m). A stall longer than 2 s, or leaving the corridor (> half-width + shoulder + 5 m, or 4 m below the bed), is logged and the drive restarts 6–8 m further on (listed per pass).
- **Telemetry and limits**: actual velocity, body heading, input steer and one-step heading/velocity derivatives are sampled every 0.1 s plus first/last steps. Native spatial hairpin stations are explicitly mapped to chain plan stations from matching baked/source points. Steering reserve is input headroom only. Grip is damping exp(-22·dt), so physical tyre-force margin is unavailable. The grounded cruiser has no downhill gravitational acceleration; coasting decelerates toward rest. This scenario cannot measure an inertial downhill top speed.
- **Static** (every 2 m station, no driving): *lateral scan* both sides in 0.25 m steps from the centreline at the deck height — `geography.contact` (r 0.2) at the rider's body band, surface continuity (±0.5 m), water, > 40°, or no ground; a transverse crack between segment prisms (deck continues 0.15 m either side along the road, or within 0.6 m further out) is stepped over, not an edge → usable width, drop depth beyond the first edge. *Missing guard* = a drop > 1.25 m that starts within the bed edge + 1.5 m with no rail/wall stopping the scan first (drops further out are listed as MINOR `verge-drop`). *Unguarded step* = 0.5–1.25 m drop at the edge. *Buried* = visible terrain above the deck at five points across the carriageway (skipped under a roof whose underside is below that terrain). *Floating edge* = deck-edge bottom (deck − 0.6 m) more than 0.3 m above the terrain 0.3 m outside the edge with no wall/rail/support solid below it (not on structures). *Headroom* = every downward-facing static face whose plan falls inside the carriageway box of that station with its underside 0.1–5 m above the deck (this road's own parapet coping excluded), plus the dynamic (Mountain v2) ceiling. *Native owned guards* remain physical width limits and controller contacts; only duplicate scenery/obstruction labels are omitted when source endpoints, station, level and edge placement agree. Intrusions and adjacent road levels retain their findings. *Kerbs* = own kerb solid at ±half-width. *Scenery* = non-walkable static solids not belonging to the road, and v2 dynamic solids except verified same-station, same-level native edge guards, within the carriageway + 1 m, 0.3–4.5 m above the deck.
- **Lips** (every 0.1 m along five lines at 0, ±0.375, ±0.75 × half-width, interpolated so a line never cuts a corner): step in the physical surface with the local grade removed, > 0.08 m. A run of steps that returns to its starting height within 0.6 m is one *crack* (gap) or *ridge* — the 1.12 m wheelbase bridges a crack ≤ 0.3 m wide, so such a crack is MAJOR only when deeper than groundSnap (a foot, a board wheel or the rider's centre can fall in), else MINOR. *Junctions*: every threshold crossing of a road — the other route's bed ±20 m (to the road edge + 6 m) and the road ±15 m on three lines. *Pads*: every non-threshold pad within reach of a road — three lines from the road into 4 m inside the pad. *Transitions*: ±15 m on five lines at every structure-bed end within 12 m of a road. *v2 planting*: `mountainPlanting('full')` trees and shrubs kept where the region draws them, against every road (trunk inside the carriageway, within 1 m of it, or crown below 2.8 m over it).
- **Cross-reference**: every static finding lists the driving events (type:pass) within ±6 m of it, so "a lip exists" and "the cruiser felt it" stay separate facts.
- **Sampling**: nothing was sub-sampled beyond the steps above; the whole run took 44.1 s.
- **Severity**: BLOCKER = stops or launches the cruiser (stall, airborne > 0.1 s, lip up > 0.48 m or down > 0.55 m that is not a narrow crack, hole), buries it (terrain > 0.48 m over the deck), or headroom < 1.55 m. MAJOR = lip > 0.15 m, crack deeper than 0.55 m, missing guard over a > 1.25 m drop, usable width < 7 m (8 m roads) / < width − 0.5 m (5 m spurs), grade > 12 % per 10 m, contact while inside the carriageway, obstruction inside the carriageway at body height, buried 0.15–0.48 m, floating edge > 1 m, headroom < 5 m, v2 tree trunk in the carriageway, the Bight Bridge frame mismatch when V01's edge leaves the deck. MINOR otherwise.

## Totals

| Road | Length m | BLOCKER | MAJOR | MINOR | Drives (dir/lane: distance, restarts) | Kerb cover L/R |
|---|---:|---:|---:|---:|---|---|
| mountain-chain | 1289 | 0 | 1 | 12 | fwd/centre: 1287.5 m, 0r; fwd/right+2: 1287.5 m, 0r; rev/centre: 1287.5 m, 0r; rev/right+2: 1287.5 m, 0r | — |
| **all** | | **0** | **1** | **12** | | |

Issue counts are after merging the same driving event (same type and solid within 6 m) across passes and merging static stations into runs.

## Top issues (BLOCKER, then MAJOR; main roads first)

| # | Sev | Road | Station m | At [x, y, z] | Type | Cause | Seen by drives |
|---:|---|---|---|---|---|---|---|
| 1 | MAJOR | mountain-chain | 540.5 | [1325.5, 69.6, 671.2] | drive-lip | step down 0.18 m between mountainV2:orchard-lane and mountainV2:mountain-road | rev/right+2 |

## mountain-chain — 9.6 m bed, 1289 m

Drives: **fwd/centre** 1287.5 m in 115 s sim (mean 11.18 m/s, max 16), 0 contact steps, 0 airborne steps · **fwd/right+2** 1287.5 m in 114.8 s sim (mean 11.19 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/centre** 1287.5 m in 115.1 s sim (mean 11.16 m/s, max 16), 0 contact steps, 0 airborne steps · **rev/right+2** 1287.5 m in 115.4 s sim (mean 11.14 m/s, max 16), 0 contact steps, 0 airborne steps

| Sev | Type | Station m | At [x, y, z] | Value | Passes | Cause |
|---|---|---|---|---|---|---|
| MAJOR | drive-lip | 540.5 | [1325.5, 69.6, 671.2] | -0.179 m | rev/right+2 | step down 0.18 m between mountainV2:orchard-lane and mountainV2:mountain-road |
| MINOR | slow-corner | 321.5–333 | [1287.9, 55.6, 741.7] | 5.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.8 m, driver down to 5.0 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 470.5–489 | [1373.3, 62.9, 697.8] | 6.5 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 6.5 m, driver down to 5.1 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 530–553.5 | [1333.7, 68.6, 678.9] | 5.8 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 5.8 m, driver down to 4.8 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 660–677 | [1389, 85.7, 598] | 14.3 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | tight curve: radius 14.3 m, driver down to 7.6 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 696.5–701 | [1366.8, 88.8, 604.9] | 13.2 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 13.2 m, driver down to 7.3 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 726–743 | [1341.4, 92.9, 594.2] | 10.7 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | hairpin: radius 10.7 m, driver down to 6.6 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 867–869 | [1215.6, 108.8, 566.2] | 15.6 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 15.6 m, driver down to 7.9 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 882.5–886 | [1208.1, 110.9, 553.1] | 14.9 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.9 m, driver down to 7.7 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1104–1108.5 | [1397.1, 137.1, 534.4] | 14.5 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.5 m, driver down to 7.6 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1132–1134.5 | [1380.2, 141.2, 514.3] | 14.4 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | tight curve: radius 14.4 m, driver down to 7.6 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1154–1173 | [1358.6, 144.2, 511.1] | 7 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (4×) | hairpin: radius 7.0 m, driver down to 5.3 m/s (cornerSpeed 8) |
| MINOR | slow-corner | 1203–1229 | [1388.6, 152.2, 473.8] | 14.2 m radius | fwd/centre, fwd/right+2, rev/centre, rev/right+2 (8×) | tight curve: radius 14.2 m, driver down to 7.5 m/s (cornerSpeed 8) |

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
