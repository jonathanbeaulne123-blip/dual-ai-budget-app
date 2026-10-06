# Claude handoff: The Water's Way, PR 2 "the land"

- **Status:** integrated on branch `claude/waters-way-land`, pushed; PR to open from this handoff. Not merged, not deployed, not live-verified. The Horizon is dev-gated (`public/.assetsignore` drops `/horizon/**`), so "live" would mean the dev-gated route on the Workers build after a merge.
- **Base:** `claude/waters-way-common` (PR 1, #588, `4104445`, which carries `origin/main` to #589, the Journey map's Horizon Clock). PR 2 should merge after PR 1.
- **Branches merged:** `ww/land-v31` (L1 Highlands V3.1 + the second stream, D-WW50…56), `ww/land` (L2a the Reach's open rails, the Greenway and its pools, D-WW60…69), `ww/land-south` (L2b Little Harbour, Long Sands, the Green's land asks, D-WW70…79), `ww/land-west` (L3 Scholars' Edge, the Flats, the Bight, D-WW80…89); integration decisions D-WW90…94.
- **Risk:** Medium-High (terrain, beds and solids under live routes; a moved glider landing; a changed bake). No money, command, schema, sync, Auth/RLS or Hercules payload change. No household data read or written.
- **Budget delta (5):** 0. Nothing here reads or writes the books. **Engagement delta (3):** + (a highland with a real horn and a hamlet shelf, the Greenway across the marsh with six lookouts, the Long Sands pier and promenade, the Glasshouse stair, the Bight lookout and the stargazing pad: places to walk to on the evenings the books are done).

## Household outcome

Jonathan and Bianca can walk the island's water story from the crown to the sea: up to the Highlands' horn and Bench Hamlet, down past the Veil to the Green and the Glasshouse stair, along the Greenway's deck over the Reach marsh to six lookouts, out onto the Long Sands pier, round to the Bight lookout at Scholars' Edge and the stargazing pad on the Flats. This PR is the ground only: buildings, plants, props and lamps are PR 3/4.

## What changed, by area

- **The Highlands (L1):** one ridge system, stepped strata on V3's own ground, the horn steepened under the v2 summit (156), the Veil's one amphitheatre with Fallswatch on the flat-topped west buttress, Bench Hamlet a 72 × 44 m shelf at ≤ 8 %, the second stream (Hollow Tarn → Hollow Beck under Green Road on the 17 m Hollow Beck Bridge into Orchard Brook), and the drag lift's stations, towers and line as structure (a 68 m tow, Twin Tarns [1144,404] → Orchard Bench [1192,355.6]).
- **The Reach and the Greenway (L2a):** open timber rails on the boardwalk and its bays, Notch Bluff, Sunset Rail, the Channel Hide, page I at the boardwalk's north end; the Greenway (6 m deck on piles end to end, three bridged crossings, the Bluff End), its places, and 34 scraped marsh pools ≤ 0.3 m.
- **Little Harbour, Long Sands, the Green (L2b):** Town Weave (S3) 8 m inland at the quay (3B), page A retargeted to the glass dam, the Glasshouse stair-and-ramp and the scarp batter, the pier (shortened to z 1520 for the ferry; wheel hub [1010,19.6,1509]), the sunken skate bowl at [1000,1456], the promenade and the Strand, Green Road's protected-circle lanterns as 0.8 bollards.
- **Scholars' Edge, the Flats, the Bight (L3):** windsock at [467.5,508], the strip's clearances as contracts (approach box; side clearance 28 m, the elevator passes), the stargazing pad, the Wash Arch over S2 (lintel 6.72 clear), five hoodoo footings, page H re-posed, the Bight lookout (deck 52.0, ramp 6.7 %), courtyard B's terrace, the partial Bight Shore batter.
- **Integration:** one open-rail builder and marker for every open rail (D-WW92); the prepared-bed cache validated against its source; the glider's `sands` field moved (D-WW90); the Bight batter reads the built Greenway (D-WW93); the corridor survey ignores scraped pools so the Long Sands Shore stop stays at Long Sands (D-WW91, `land/corridor/stations.ts`).
- **Tests changed with the reason in place:** `horizonGliderJourneys`, `horizonGliderJourneysWind` (D-WW90), `horizonGliderReducedMotion` (D-WW94), `horizonLandWWWest` (D-WW93), `horizonHeldWalkOut` (page I moved, D-WW64: lite would-fall list drops I), `journey-road` (the Hollow Beck Bridge is a new road span, D-WW55). Each passes unmodified on `origin/main` (checked in `/home/claude/wt/base9d`, 4746796). New: `horizonLandWWOpenRails` (27).
- **Evidence:** `docs/horizon/evidence/waters-way-land/` (18 before/after JPGs, `LOOK.md` describes each; SwiftShader, not device evidence).

## Verification (exact)

- `pnpm horizon:bake` then `pnpm horizon:check`: byte-exact. 1,505 solids, 839 diagnostics, **137 conflicts** (PR 1 head 138). Merging PR 1 into the land changed no baked byte; the D-WW91 fix changed only corridor stations, lamps, planting and the stop.
- Index vs the PR 1 head: water 34 → 69, beds 162 → 213, structures 1,184 → 1,505 (+328 −7), crossings 694 → 754, thresholds 100 → 108, lights 459 → 463. Every moved corridor station, lamp and guard sits at a land change: Long Sands (promenade), the High Span (Greenway), the Highlands' south (VG), the Hollow Beck, the Bight services (batter), the Stillwater spur, the stargazing walk, Sunset Rail.
- Journey clay budget (`JOURNEY_LAND_BUDGET` 25,000 / 15,000 tris, 20 draws): full **19,556 / 12**, lite **13,816 / 13**; with dressing full 19,934 / 11, lite 13,602 / 12 (crowded 22,812 / 13, 13,944 / 14). No raise.
- Suites, one file at a time (`--maxWorkers=1`), all green: horizonLandWW{OpenRails 27, West 15, Highlands 19, Reach 23, South 26}, horizonStorySightChain 16, horizonManifest 35, horizonBeds 17 (one vitest RPC "onTaskUpdate" timeout after all passed, the machine's load), horizonStructures 23, horizonCrossings 12, horizonThresholds 8, horizonViews 11, horizonWater 11, horizonTerrainCuts 18, horizonLandforms 11, horizonCorridor 16, horizonCorridorArt 10, horizonCorridorPlan 10 + 1 skipped (same on main), horizonCorridorPlanting 11, horizonBridges 16, horizonSkyEnvelope 5, horizonGlider{Journeys 22, JourneysWind 6, ReducedMotion 16, Landing 12, Pads 38, PadsGuide 4, Lift 8, Bodies 3, Camera 11, Controller 24, NoMoney 49, Polar 13}, horizonBakeArtifacts 7, horizonWorldDefinition 3, horizon-mountain-v3 7, horizonStillwaterLink 3, horizonWalkSim 38, horizonHeldWalkOut 29, horizon-native-skate-anywhere 15, horizon-airport-flight 26, horizon-airport-world 7, journey-land 34, journey-road 13, horizonDressingJourney 7, horizonDressingBake 17, horizonDressingLayer 11.
- `pnpm typecheck`: clean. `git diff --check origin/main...HEAD`: clean.
- Road audit (`scripts/horizon/road-audit.mjs`): **5 BLOCKER / 22 MAJOR / 104 MINOR, 0 restarts** vs the PR 1 head's 5 / 22 / 102. Two new MINORs: V01 [1367.6,1232.8] a 0.78 m unguarded step at Sunset Rail's stub entrance (its opening has no kerb; the pad's grading lowered the verge 0.33 → 0.91); VG [953.6,494.4] a 0.76 m step where the Hollow Beck's postRail ends one station early on the beck's bank. Changed in place: VG s 220–230 under the High Span 0.82 → 1.12 m (the Greenway's passage); the Stillwater spur's buried BLOCKER 5.15 → 4.68 m; a Glasshouse spur MAJOR now names the footbridge support instead of the retaining wall (same spot).
- S3 on the board: one unbroken `runLine` from S3's start stalls at s 93.4 ([1483.8,1144.7]) on `origin/main` and on this land alike; the Town Weave 3B stretch (s ≈ 210–300) rides clean. S3 start → end belongs to `horizonSkateLines` (baseline failure here).

## Rough areas

- The two new road MINORs above (a kerb or a two-station guard extension each).
- The Long Sands Shore stop sits 30 m west of its PR 1 spot, at [1199.3,1402.1]: the promenade's level 3.0 tilts the old verge. D-WW76's text says the promenade ends at x 1215 but its points run to x 1245.
- The Bight batter is partial (walls 19.0 / 18.1 / 13.4 / 11.3 m remain; 6.73 m to the Greenway).
- Prow → Long Sands under the shipped wind is still short (−0.46 m).
- Captures are SwiftShader; no device or runtime theme captures (owed with the dressing).

## Jonathan's calls

1. **The drag lift's short tow** (68 m, Twin Tarns → Orchard Bench): the cirque rim is inside the skylight keep-out and on v2's land.
2. **The sands landing move** (D-WW90): [1095,1362] r 60 → [1185,1355] r 35, or keep a larger field over the Drive.
3. **The partial Bight batter** (D-WW89): a full batter needs the Greenway ~30 m off the lagoon faces, or the plots' lagoon margins given up.
4. **The shorter pier and the wheel inland** (D-WW74): pier to z 1520 so the ferry passes; the wheel's hub at z 1509, 139 m inland of the drawn spot.
5. **The glacier stays hidden from the south and west** (ruling 7): you find the source by climbing.

## Next owner

PR 3/4 dressing (buildings, plants, props, emissive night cards in three themes on this ground; the airport art windsock removal; the two road MINORs if the dressing doesn't cover them). PR 5 rides (the drag lift, the skate bowl).
