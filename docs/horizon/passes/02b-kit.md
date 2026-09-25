# Pass 2b — The kit, the sun clock and the lights

> 25 September 2026 amendment: D13 is confirmed at 1.0; D12 retains three uphill Terraces plots and four Bight Shore plots (seven large plus two small). These decisions supersede earlier scale recommendations, counts and plot-4 review-history notes below. See the live decision register and MANIFEST v1.6.

Builders: **Claude subagents**, six tracks, one integrator, one reviewer who has not seen the work. Runs in parallel with pass 2 (movers). Gate: Jonathan looks at the kit render sheet, then at the twelve pages with the sun running. Delivery: `~/Downloads/hearth-horizon-p2b-kit/`.

---

## Purpose

Build every reusable piece in `STYLE §3` on the painted-card kit, in three authored dressings with a day and a night state, full and lite; the sun clock and the light-card kit (`LIGHT §1`, `§3`, `§4`); planting cards per biome with bloom by date; ground paint per surface; the sky, fog and weather; the dressings' material swaps; the reserve dressing. Neighbourhood passes will **place** these pieces; they never model their own.

The Mountain v2 lesson: "The Skate v2 painted-card kit existed and the mountain used none of it" (`inputs/mountain-dissection-summary.md`). This pass makes the kit the only way anything is drawn.

## Inputs

| Input | Keys / sections |
|---|---|
| `CONTRACT.md` | §2.2 (nature never encodes money), §2.5, §2.6, §2.10, §2.11 (three dressings authored, not tinted), §5 (reserve dressing), §6 |
| `LIGHT.md` | all |
| `STYLE.md` | all of §1; all of §3; §2 sheets for each piece's "where used" |
| `MANIFEST.json` | `surfaces`, `reserves`, `protected`, `names`, `landforms` (snowline heights), `water.stillwater` (ice) |
| `inputs/grand-plan.html` | the flora table (species, Latin name, twelve-character month string `b` / `e` / `s` / `.`, colour) — the only source of bloom months |
| Code at `PIN-1` | `src/harbour/art/{cardKit,cardScene}.ts`, `src/harbour/mountain/art/*.ts` (`palette.ts`, `plantArt`, `bridgeArt`, `buildingArt`, `damArt`, `damParts`, `damSolids`), `scene/groundPaint.ts`, `lightRig.ts`, `src/harbour/horizon/sun/solar.ts`, `src/harbour/horizon/sky/{gradient,fog,horizonCards}.ts`, `src/harbour/court/dressing.ts` (read only), `src/harbour/horizon/movers/shared/{vehicleArt,wind}.ts` (from pass 2's commit 1) |

## Base SHA rule

- Branch `claude/horizon-kit` from `PIN-1`.
- Kit pieces are built and rendered on the kit sheet first. Nothing is placed on the land except the reserve dressing (`CONTRACT §5`: "dressed in the kit pass") and the lamp cards behind pass 1's and pass 2's anchors.
- No geography change. Merges with pass 2 into `PIN-2` through `claude/horizon-p2-integrate`.

## Tracks

| Track | Builds | Owns | Must not touch |
|---|---|---|---|
| K1 | Sun, moon, sky, weather | `src/harbour/horizon/sun/{clock,moon,sundial}.ts`; `src/harbour/horizon/sky/{gradient,fog,clouds,weather,wind,almanac,aurora}.ts` (takes over pass 1's `gradient`, `fog`); Mountain v2 `lightRig.ts` | `sun/solar.ts` signature (read only; a change is a request to the integrator); other kit folders |
| K2 | Light cards and night | `src/harbour/horizon/kit/lights/**` (glow, halo, pool, `LightAnchor` adapter, sequencing, lite cap), `src/harbour/horizon/kit/night.ts` (night palettes by family × dressing) | `world/lights/*` data files (pass 1, 2, 3 own their anchors) |
| K3 | Architecture | `src/harbour/horizon/kit/architecture/**`; `src/harbour/mountain/art/{bridgeArt,buildingArt,damArt}`, `damParts`, `damSolids` | the `BasinReading` binding anywhere (Lakeside pass moves it) |
| K4 | Furniture, signs, play pieces, reserve dressing | `src/harbour/horizon/kit/furniture/**`, `src/harbour/horizon/kit/signs/**`, `src/harbour/horizon/kit/play/**`, `src/harbour/horizon/kit/reserves/**` | `land/reserves/**` (pads are pass 1's) |
| K5 | Vehicles and landmarks | `src/harbour/horizon/kit/vehicles/**` (implements `VehicleArt`), `src/harbour/horizon/kit/landmarks/**` | `movers/**` |
| K6 | Planting and ground | `src/harbour/horizon/kit/planting/**` (incl. `flora.ts`), `src/harbour/horizon/kit/ground/**`; `src/harbour/mountain/art/plantArt`, `scene/groundPaint.ts` | other kit folders |
| I | Integrator | `src/harbour/horizon/kit/dressings.ts` (the registry), `src/harbour/horizon/kit/sheet.ts` (dev-only kit sheet), `src/harbour/art/{cardKit,cardScene}.ts`, `src/harbour/mountain/art/palette.ts`, the harness story for the sheet | `src/core/**`, movers, land |
| R | Reviewer | `evidence/review/**` | everything else |

All tracks: must not touch `src/core/**`, `src/harbour/data/reading.ts`, `src/harbour/village/layout.ts`, `src/harbour/court/dressing.ts` (read only), `src/harbour/horizon/land/**`, `src/harbour/horizon/world/**` except where the table says, the presence wire, the Worker, the Desk.

---

## K1 — Sun, moon, sky, weather

- **The sun clock** (`LIGHT §1`): wraps `solarPosition()` at 44° N from the device clock and time zone, no network. Steps every 60 s of real time: on the step the sun direction, shadow map and lit-window state update with a 400 ms cross-fade (`STYLE §1.2` rule 4); the sky gradient and fog interpolate continuously as uniforms. The shadow map re-renders on the step and on district load only, never per frame (`CONTRACT §6`); lite at half resolution.
- **Shadow strength** by sun elevation `e` (`STYLE §1.2` rule 5): `e ≥ 30°` 0.42; 6–30° 0.50; 0–6° 0.58; moon 0.22 when the moon is ≥ 20° up and ≥ 50 % lit, else none. Shadow colour = hemisphere sky colour × 0.45. Softness per rule 6 (PCF ≥ 3 × 3 full; ease to 60 % at 250 eu).
- **Overrides:** `?sun=HH:MM` and `?date=YYYY-MM-DD` (dev builds only, built in pass 1 per `LIGHT §1`) hold the clock; reduced motion and calm view freeze the sun at 15:30 in 21 June light; the sundial (below) scrubs a preview.
- **The sundial** (Little Harbour's square): stone dial, brass gnomon; the gnomon's shadow is the shadow map, never painted; press and drag scrubs the day as a preview; release snaps back to the real time. C engraved stone, T paper clock face, N granite with painted numerals.
- **The paper moon:** real phase from the date; gives the night ambient its direction; moon path strip on Stillwater, the Bight, the harbour and the sea, width ∝ illuminated fraction (`STYLE §1.7`); the Bight sandbar shows at full moon (`LIGHT §7`).
- **Sky gradient** (`STYLE §1.8`): the six elevation rows for Classic, and the Taylor and Newfoundland rows, day and night.
- **Fog:** full near 150 eu / far 700 eu; lite 110 / 520; almanac fog day 40 / 220; near and far grow with eye height (+0.9 h, +1.35 h); fog colour = horizon colour in the heading.
- **Clouds, rain, snow, aurora:** paper cloud layers 2–4 (lite 1) between 180 and 280 m; rain streaks within 40 eu, wet states per surface; snowline Dec ≥ 125 m, Jan ≥ 95 m, Feb ≥ 90 m, Mar ≥ 120 m, north faces 15 m lower; aurora in Newfoundland only, Nov–Mar, after 22:00, clear almanac.
- **Wind clock** (`sky/wind.ts`): one shared wind drives crowns, grass, flags, halyards, the windsock, clouds, surf and gliders; implements `movers/shared/wind.ts`. Trunks never move.
- **Almanac** (`sky/almanac.ts`): if `main` at `PIN-1` has a weather almanac, wrap it; otherwise the deterministic, date-seeded almanac of `LIGHT §1` (clear 55 %, overcast 20 %, wind 12 %, drizzle 10 %, snow 3 % in Dec–Mar only; the Wash runs for six hours after drizzle) with no network, so both partners see the same weather on the same day. It never reads a balance.
- **Date override:** `?date=YYYY-MM-DD` already exists from pass 1 (`LIGHT §1`); K1 reads it for seasonal captures and never ships it in production.

## K2 — Light cards and night

- Every row of `STYLE §1.11` as a **glow card** (unlit), a **halo** and a **pool decal**, with the table's colour, sizes, pool radius and motion. No dynamic point lights anywhere.
- `LightAnchor` adapter: a neighbourhood places an anchor (`id`, position, type, dressing housing, `on` rule, line id and index); the adapter makes the cards. `on` rules from `LIGHT §3` (civil dusk → civil dawn; windows dusk → 23:00 then one per house; the Lamp's 8 s sweep; campfire 21:00–01:00; aurora rule).
- **Sequencing:** lights on a line come on 1 s apart in line order (Lantern Row west to east), never all at once. The "first time the island is opened after dark" moment is a sequencer mode the Little Harbour pass triggers.
- **Lite cap:** 48 visible light cards, nearest first; a pool counts with its card; beyond 120 eu a line collapses to one dotted strip card; the Lantern Cave collapses beyond its nearest 24 into one cluster glow.
- **Night palettes** (`STYLE §1.3.3`): each material family's Classic, Taylor and Newfoundland night colour and lamplit behaviour; ink at night `#1a1a24` at 0.8 opacity; chalk at night 30 % and on the moon side.
- **Readable night** (`LIGHT §1`): at 02:00 the L* histogram mode is 12–35; only light cards, pools, lit windows and moon glints exceed L* 75; every door, threshold and edge lip reads.

## K3 — Architecture

Every row, three dressings (`STYLE §1.3.4`), day and night, full and lite (lite subtracts, never substitutes, `STYLE §1.13` rule 4):

| Piece | Source rule |
|---|---|
| Storefront (plinth, walls, recessed door 0.2 eu, window with interior flats, eave with underside, sign on brackets; C gable + stone-timber, T scallop + paper, N saltbox + clapboard) | `STYLE §3.1`, §1.1 rejected treatments |
| Market stair + ramp (3 eu wide, riser faces, cheek walls, rail per flight 1.05 eu, ramp ≤ 8 %) | `STYLE §3.1` |
| Retaining wall (batter 1 : 6, 0.15 eu coping, weep holes every 3 eu) | `STYLE §3.1` |
| Parapet (1.0 eu + 0.15 coping, piers every 12 eu); kerb (0.15 × 0.25 eu) | `STYLE §1.6` rule 4 |
| Culvert (headwall, arch ring, wingwalls, foam at the mouth); the Dune Culvert (`structures.duneCulvert`: S4 under V01, 3 m clear) as a dune tunnel with a ceiling | `STYLE §3.1` |
| Covered bridge (Hollow Bridge: truss, board-and-batten sides with windows, shingle gable, portal lanterns, S4 rail outside, the ninth basket's mount) | `STYLE §3.1` |
| Bridge decks and undersides: High Span (masonry deck-arch, shelf corbelled through the spandrel, walk at the water), Quay Bridge (three segmental arches; V01 with S3's separated lane), Bight Bridge (timber trestle, S2's separated lane with the full-length rail), the inlet and Reach footbridges (timber on piles), the Apron Bridge (S1 over the tailrace), the plank footbridge at the Wash mouth on the Bight pier walk | `STYLE §3.1`, §1.6 |
| Tunnel portal (voussoirs, wingwalls, lining, lamps every 15 eu): Prow Tunnel, Shoulder Tunnel, the Ore Line's South Portal | `STYLE §3.1` |
| Jetty (0.35 eu deck on piles, waterline rings, handrail where deep, end lamp); the Sea Stair (cliff stair from the Sea Door pier to the Prow walk: treads with riser faces, a rail per flight, landings with lamps) | `STYLE §3.1` |
| Dam parts, re-faced south toward the square: glass face showing Stillwater at its constant level, steel fins, abutments, crest walk with parapets both sides, apron, spillway arch (Ring Run gate 4), the Dam Gallery door (a stair in the east abutment, not an Undercroft door); the `L01` chamber card prepared. The gauge strip stays on the dam, bound as it is, until the Lakeside pass builds `L01` and moves the binding in one PR; the kit ships the strip-less face as the target state behind that PR | `STYLE §3.1`, §2.6 |
| Rock strata sets: Crown, Notch, Ochre, Sea cliff, Undercroft | `STYLE §3.3` |

**The dam and money:** K3 re-faces the dam's art only. The `BasinReading` binding and the gauge strip it drives stay exactly where they are at `PIN-1` until the Lakeside pass moves the binding to `L01` in the same PR that builds `L01` (with a Codex trust review). K3 does not delete, move or restyle any money-driven element; the Kitty chambers' retirement is D14 (open) and happens, if approved, in the Lakeside pass.

## K4 — Furniture, signs, play pieces, reserve dressing

| Piece | Source rule |
|---|---|
| Threshold marker (inset plate 2 × 0.6 eu, neighbourhood accent, mode stencil from cardKit `ICON`; reflective at night) | `STYLE §3.1` |
| Bike / board rack | `STYLE §3.1` |
| Milestone (0.9 eu post; line 1 next neighbourhood from `MANIFEST.names`, line 2 arrow and whole minutes on foot from the path graph at `scale.factor`; never lit; reflective letters) | `STYLE §1.10`, §3.1 |
| Signs: one hand-lettered face per dressing (Classic Fraunces engraved, Taylor Caveat on tags, Newfoundland Figtree 800 capitals); cap height ≥ 0.16 eu on path signs, ≥ 0.10 eu on plaques; boards > 1.2 eu on two posts; no world-space billboard text | `STYLE §1.6` rules 7–8, §1.10 |
| Lantern post housing (2.6 eu) and low lantern housing (0.8 eu); K2 supplies the light | `STYLE §3.1` |
| Bench (0.85 eu back), picnic table, stone wall with gap, rope fence, bollard | `STYLE §3.1` |
| Bocce court, disc-golf basket (never lit), kite, paper boat | `STYLE §3.1` |
| Hoarding set: hoarding fence, surveyor's stakes and string, timber stack, one sign per dressing (C "Not yet", T scrapbook "someday" tag, N hand-lettered board), wildflowers and a bench beside; never lit; no lantern spot inside | `CONTRACT §5`, `STYLE §3.1` |

**Reserve dressing on the land:** K4 places the hoarding set on all seven plots (`plot.terraces.1–3`, `plot.bight.1–4`) and the two small reserves (`plot.under.1`, `plot.flats.1`) on pass 1's pads. It is the only land placement in this pass.

## K5 — Vehicles and landmarks

Implements `VehicleArt` (anchors `seat[]`, `cameraMount`, `runningLights[]`, `contact`) for: gondola cabin and its three towers (`cable.G1.towers`; cable sags), mine cart + rail + timber set (sets every 2.5 eu, mine lamp every fourth set; one brake lever ≥ 0.2 eu), zip towers: the Prow tower (30 m, roofed deck at `h` 100 with the clip rail, shared with the glider launch) and the landing tower on the dune crest (deck `h` 12 with the buffer, 8 m above the Town Weave boardwalk that passes beneath it, a stair and a ramp to the sand), glider wing card (ribbed paper, visible spars), the plane (yellow `#e8c547` in all three dressings; floats and wheels as swappable parts; rivet pencil lines), balloon (16 gores, lite 8; wicker basket; tether), rowboat / canoe / dinghy, the Ferry (deck, wheelhouse, railings, a gangway; two hulls in service, `water_routes.FERRY.hulls`), runway lamp + windsock, hangar shed (barrel roof, the empty bay `plot.flats.1`), lighthouse (gallery at 25 m, lantern room). Each per `STYLE §3.1`'s row, three dressings, day and night.

## K6 — Planting and ground

- **Flora data:** transcribe the Grand Plan's flora table (`inputs/grand-plan.html`) into `kit/planting/flora.ts`: species, Latin name, twelve-character month string, colour, biome. `test/horizonFlora.test.ts` asserts every row matches the HTML source.
- **Planting cards per biome** (`STYLE §3.2`): every tree and flower card, 3–5 archetypes full, 3 lite; Newfoundland swaps (`STYLE §1.4.4`); Taylor paper stocks per neighbourhood; trunks visible (broadleaf ≥ 30 % of height, conifers ≥ 10 %); crowns ≥ 10 L* darker than the turf and ≥ 8° different in hue.
- **Bloom by date** (`STYLE §1.4.2`): bud, bloom, fade, seed/fruit, leaf, bare/snow, autumn colour, interpolated by day of month; snow caps in the snow season.
- **Placement helpers** (for pass 3, not used on the land here): grove (5–12 trees, 2.5–5 eu spacing, clearing ≥ 1.5 × diameter), orchard row (6 eu rows, 4.5 eu trees, broken ends), drift (3–8 eu, second species ≤ 25 %), hedgerow (2–4 eu outside the kerb), biome blend band 8–20 m, clearance rules (`STYLE §1.4.1` rules 7, 10, 12). All instanced.
- **Ground paint per surface** (`STYLE §1.5`): all thirteen `MANIFEST.surfaces` ids with their Classic look, wet state, snow / ice state, and three dressings (paving per `STYLE §1.3.4`); a paint change on the same lattice, never a new mesh. Footstep ids from `MANIFEST.surfaces[*].footstep`. Sand prints last 60 s.

## Integrator — the dressings registry and the kit sheet

- `kit/dressings.ts`: one registry mapping every material family to its Classic, Taylor and Newfoundland material (`STYLE §1.3.4`), day and night (from K2's `night.ts`). Every piece gets its materials only from here.
- **Not a tint:** for every piece `STYLE §1.3.4` covers, the three dressings differ in geometry, joinery, edge treatment or ornament, not only colour.
- `kit/sheet.ts`: a dev-only harness story that lays out every piece in rows on a neutral ground under the running sun; switchable dressing, time (`?sun=`), tier. Not in the production build.
- Wires the kit into pass 2's `VehicleArt` at the merge into `PIN-2`.

## Must produce

- [ ] Every row of `STYLE §3.1`, §3.2, §3.3 and §3.4 built on `cardKit` / `cardScene`, in Classic, Taylor and Newfoundland, with a day and a night state, full and lite.
- [ ] The sun clock, moon, sundial, sky, fog, clouds, rain, snow, aurora, wind clock and almanac per K1.
- [ ] The light-card kit, `LightAnchor` adapter, sequencer, lite cap and night palettes per K2.
- [ ] Ground paint for all thirteen surface ids with wet and snow / ice states.
- [ ] Flora data matching the Grand Plan table; bloom by date.
- [ ] The hoarding set on all ten reserves.
- [ ] The kit sheet and its captures.

## Must not

- Model anything outside the card kit; no photo textures, textured billboards, flash-card panels, CSS-style boxes, box-plus-pyramid storefronts (`STYLE §1.1`).
- Make a dressing a palette swap.
- Paint a cast shadow; bake a directional darkening; re-render the shadow map per frame.
- Add a dynamic point light or world-space text.
- Let weather, bloom, snow, ice, the lake, the sun or any light read a balance (`CONTRACT §2.2`).
- Move, delete or restyle the dam's `BasinReading` binding.
- Place any piece on the land other than the reserve dressing.
- Use real household data.

## Tests to add

| Test | Proves |
|---|---|
| `test/horizonSunClock.test.ts` | 60 s steps; shadow re-render only on step and district load; reduced motion and calm freeze at 15:30 June; `?sun=` holds; sundial scrub snaps back |
| `test/horizonMoon.test.ts` | phase from date; moon shadow rule; sandbar visible at full moon only |
| `test/horizonSkyGradient.test.ts` | the six elevation rows × three dressings |
| `test/horizonLightCards.test.ts` | every `STYLE §1.11` row; `on` rules; 1 s sequencing; lite cap 48 nearest-first; line collapse beyond 120 eu |
| `test/horizonKitDressings.test.ts` | every piece built from the registry; three dressings not a tint (geometry or material kind differs) |
| `test/horizonKitThickness.test.ts` | `STYLE §1.1` thickness minimums; undersides present; contact shadow on every grounded piece |
| `test/horizonFlora.test.ts` | flora data equals the Grand Plan table; bloom stage by date |
| `test/horizonGroundPaint.test.ts` | thirteen surfaces × states × dressings |
| `test/horizonReserveDressing.test.ts` | ten reserves dressed; no light; no lantern spot inside |
| `test/horizonNatureNoMoney.test.ts` | nothing under `kit/`, `sun/`, `sky/` imports `src/core/**` or `basin.ts` |

After each section: `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1` and `tsc`. Final SHA only: `pnpm build`, then `pnpm test -- --risk=high --focus=harbour --focus-reason="horizon p2b: kit, sun clock, light cards, planting, ground paint"` within five minutes.

## Evidence required

| Evidence | File |
|---|---|
| **The kit render sheet:** every piece in three dressings, day and night, full and lite (12 sheets per track: 3 dressings × 2 times × 2 tiers) | `evidence/sheet/<track>_<dressing>_<day\|night>_<full\|lite>.png` |
| Planting per biome, one sheet per biome per season (bud, bloom, fade/seed, snow) | `evidence/sheet/K6_<biome>_<season>.png` |
| Ground paint, thirteen surfaces × dry / wet / snow-ice × three dressings | `evidence/sheet/K6_ground_<dressing>.png` |
| The twelve pages at `bestHour` and `also`, in Classic, Taylor and Newfoundland (`CONTRACT §7`: all three dressings from pass 2b on), full and lite, with the sun clock running and the reserves dressed | `evidence/pages/<page>_<hh-mm>_<dressing>_<full\|lite>.png` |
| A `?sun=09:00` and `?sun=17:00` pair on one page proving every cast shadow swings | `evidence/pages/shadowswing_<page>.png` |
| Value-range checks (`STYLE §1.3.2`) on the day sheets and the 02:00 sheets | `evidence/probes/value_range.json` |
| Reviewer's report | `evidence/review/REVIEW.md` |

## Gate

Jonathan looks at the kit sheet in all three dressings, day and night, on his Mac and his iPhone, and at two pages with the sun running. He signs off per track; a track that fails keeps its greybox behind the registry and ships in a follow-up.

## Delivery

`~/Downloads/hearth-horizon-p2b-kit/`: `p2b-kit.bundle` (`PIN-1..claude/horizon-kit`), `patches/`, `HANDOFF.md`, `FINISH-PROMPT.md`, `TEST-PLAN.md`, `evidence/`. Claude does not push; Jonathan pushes with pass 2 and records `PIN-2`.

## Reconciled to MANIFEST v1.1 (reviewer)

- K1: `?date=` is no longer a proposal (LIGHT v1.1 lists it; pass 1 builds it with `?sun=`); the almanac categories and odds taken from LIGHT §1 (the v1.0 list "clear / fair / overcast / rain / fog / snow" dropped).
- K3: the gauge strip is not removed by the kit; it stays with the `BasinReading` binding until the Lakeside PR (STYLE §3.1, v1.1 timing); Kitty chambers noted as D14. The Dune Culvert, the South Portal and the two footbridges added; the Quay and Bight Bridges' separated skate lanes named; the Dam Gallery described as a dam stair.
- K5: the Ferry gets its gangway and two hulls.

### v1.2 deltas (reviewer, MANIFEST v1.2)

- K3: the Apron Bridge, the Wash-mouth plank footbridge and the Sea Stair added.
- K5: the gondola's three towers; the zip's two towers (Prow tower deck h 100 shared with the glider launch; the landing tower, deck h 12, over the S3 boardwalk) replace the "landing on sand" platform.


## Added for SCALES.md
- **Low-poly (L0/L1) variants** of: the seven host cards, the dam, the Lamp, the Crown's snow cap, bridges and towers as single cards, station bed cards (one per recipe outcome: bloom, dark earth + seedlings, bare earth + mulch, sapling/tree, small stone, lantern, bench, birdbath, ribbons, hoop, rows, star, coal), the waymark (lit/unlit, with a year count), the tent, era gate, stakes-and-string (shared with the reserves), the Kitty sculpture (steps 0–10), signpost, memory flag.
- **Homestead cards**: kitchen garden × 5 maturities; cargo crates; workbench; pavilion × 3 states; the timber crossing × 4 wear states (planks missing by stage, repaired seam); fence × 3; all in three dressings, day and night.
- **Look rule for L0/L1** (STYLE §1.15): faceted low-poly terrain in the same palette, no ink lines, larger facets, the same sun; the prototype's look is the reference, Hearth's palette is the law.

- **Time cards** (TIME.md): paving stone (worn / laid / today), flagstone + lantern post (lit/unlit), bill slip on a post, payday pennant, stake (plain / with ribbon / with a card name), two small chairs, the station gate (ajar / closed), the tent; the recipe card and its wall pin; the drawer's table objects (past sheets, tracing paper, letter tray, chairs, recipe box, kitty, lamp, sticky notes) in three dressings.
