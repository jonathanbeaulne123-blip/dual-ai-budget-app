# Claude handoff: The Water's Way, PR 2 "the land"

- **Status:** integrated on branch `claude/waters-way-land` (local commits, not pushed); PR to open from this handoff. Not merged, not deployed, not live-verified. The Horizon is dev-gated (`public/.assetsignore` drops `/horizon/**`), so "live" would mean the dev-gated route on the Workers build after a merge.
- **Base:** `claude/waters-way-common` (PR 1, #588, `4104445`, which carries `origin/main` to #589, the Journey map's Horizon Clock). PR 2 should merge after PR 1.
- **Branches merged:** `ww/land-v31` (L1 Highlands V3.1 + the second stream, D-WW50…56), `ww/land` (L2a the Reach's open rails, the Greenway and its pools, D-WW60…69), `ww/land-south` (L2b Little Harbour, Long Sands, the Green's land asks, D-WW70…79), `ww/land-west` (L3 Scholars' Edge, the Flats, the Bight, D-WW80…89); integration decisions D-WW90…97.
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
- **Journey map (AGENTS.md, D-WW95):** re-baked with the land; the clay map carries the Highlands' ground, the Hollow Beck and its bridge, the scarp and the Bight batter (86 of 9,191 lattice points move ≥ 0.5 m). Walks, skate lines, the pier and rails are not drawn by the clay map, so the Greenway does not show (a Journey design call). Budget unchanged in kind: land alone full 19,230 / lite 13,490 triangles (≤ 25,000 / 15,000). Captures in `docs/horizon/evidence/waters-way-land/journey/` (before = `4104445`, after = this branch): the real board in Classic, Taylor and Newfoundland × full and lite, and six Classic close-ups × full and lite; `LOOK.md` says what each shows. Tool: `scripts/horizon/capture-journey-land-diff.mjs`.
- **Build time (D-WW97):** the marsh pools and the Bight batter answer the same with less work (byte-exact); `horizonBeds` no longer trips vitest's 60 s worker RPC timeout.
- **Tests changed with the reason in place:** `horizonGliderJourneys`, `horizonGliderJourneysWind` (D-WW90), `horizonGliderReducedMotion` (D-WW94), `horizonLandWWWest` (D-WW93), `horizonHeldWalkOut` (page I moved, D-WW64: lite would-fall list drops I), `journey-road` (the Hollow Beck Bridge is a new road span, D-WW55). Each passes unmodified on `origin/main` (checked in `/home/claude/wt/base9d`, 4746796). New: `horizonLandWWOpenRails` (27).
- **Evidence:** `docs/horizon/evidence/waters-way-land/` (18 before/after JPGs, `LOOK.md` describes each; SwiftShader, not device evidence).

## Verification (exact)

- `pnpm horizon:bake` then `pnpm horizon:check`: byte-exact (rc 0) at the final source. 1,505 solids, 839 diagnostics, **137 conflicts** (PR 1 head 138).
- Index vs the PR 1 head: water 34 → 69, beds 162 → 213, structures 1,184 → 1,505 (+328 −7), crossings 694 → 754, thresholds 100 → 108, lights 459 → 463. Every moved corridor station, lamp and guard sits at a land change.
- Suites, one file at a time (`--maxWorkers=1`), see the report in the PR for the full list: every Horizon land, structure, water, corridor, glider, walk, dressing and Journey suite green; `journey-mini-story` fails 4/4 with "Top up the Household Fund by $105.00" exactly as on `origin/main` 4746796 (a books-fixture clock failure, not the land).
- Sight chain (`horizonStorySightChain`, 16): every link passes; Spring Bay → the campanile 2.89 m; the Lamp from 9 of 11 eyes.
- Road audit: **5 BLOCKER / 22 MAJOR / 104 MINOR, 0 restarts** (PR 1 head 5 / 22 / 102); the two new MINORs are sub-guardDrop steps (D-WW96).
- `pnpm typecheck` (inside the CI quick gate) and `git diff --check origin/main...HEAD`: see the PR body for the final run.

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
