# Pass 3 — Neighbourhoods

Builders: **Claude subagents**, two neighbourhoods at a time (one subagent per neighbourhood, one folder each), one integrator per wave, one reviewer per wave who has not seen the work. Gate: Jonathan per wave, on his Mac and iPhone. Delivery: one folder per wave.

This file is one brief template (Part A) applied seven times (Part B).

---

## Order and rationale

| Wave | Neighbourhoods | Why this order |
|---|---|---|
| 1 | **Little Harbour** + **Lakeside** | Little Harbour is the first screen after sign-in; it must be right before anything else is. Lakeside holds the dam and `L01`, the island's one piece of money truth, and the Green; the square's signature view is the dam, so the two are proven together. |
| 2 | **The Crown & the Undercroft** + **the Hollow** | The Crown is the biggest and the Ore Line and the Throat depend on it; the Hollow holds the Adit, the Ore Line's lower door, so the two are dressed together. |
| 3 | **Scholars' Edge** + **the Landing & Long Sands** | Quiet woodland and the shore; both frame the Bight; neither depends on the others. |
| 4 | **The Flats** | The far arm; the plane and the balloon already work there from pass 2. Wave 4 ends with the one land touch-up. |

Each wave pins (`PIN-3a` … `PIN-3d`) before the next starts. `PIN-3d` after the land touch-up is `PIN-3`.

## Districts each neighbourhood dresses

The Grand Plan's between-lands have no sheet of their own. Each district goes to the neighbourhood named in `MANIFEST.json → districts[*].neighbourhood`; a district dressed by a neighbourhood whose biome differs uses the `STYLE §3.2` row for its own biome (the Green: open meadow; the Reach: water; the Bight: shore). The `offshore` district has no neighbourhood: its pieces are dressed by the neighbourhood named in the table.

| Neighbourhood | Districts (`MANIFEST.json → districts`) | Extra pages it proves |
|---|---|---|
| Little Harbour | `harbour` (the town, the Terraces' surroundings, the town quay) | — |
| Lakeside | `lakeside` (Stillwater, the dam, `L01`), `notch` (the gorge, the High Span), `green` (the Green, its protected centre, the Glasshouse steps, the bur oak) | C (High Span) |
| The Crown & the Undercroft | `crown` (the Shoulder, the summit; the Undercroft its underground child), `prow` (the cliffs, the zip tower, the Sea Door); from `offshore`: the Needle's Eye, the Stacks | J (the Needle's Eye) |
| The Hollow | `hollow` (the orchard bowl, the Adit) | — |
| Scholars' Edge | `scholars` | — |
| The Landing & Long Sands | `landing` (Long Sands, the Landing quay, the Boathouse, the Campfire, Tideline park), `reach` (the wetland, the river mouth); from `offshore`: the Lamp islet, the Wreck | I (Reach boardwalk) |
| The Flats | `flats` (the strip, the hangar, the balloon, the Wash), `bight` (the lagoon, the sandbar, Bight Shore, the Bight Bridge) | — |

Horizon Drive's verges belong to whichever district they pass through.

---

# Part A — The template

## Purpose

Turn one neighbourhood (and its districts above) from greybox land into a finished place that passes `STYLE §0.1`: hide every building, and a reviewer can still tell which neighbourhood it is and that it is still the Horizon.

## Inputs

| Input | Keys / sections |
|---|---|
| `CONTRACT.md` | all; §2.1, §2.2, §2.5, §2.6, §2.8, §2.11, §5, §6, §7 |
| `STYLE.md` | all of §1; **its own §2 sheet**; the §3 rows its sheet names |
| `LIGHT.md` | §2 (its hour), §3 (its lights), §5 (best hour), §7 |
| `MANIFEST.json` | `neighbourhoods[id]`, `hosts`, `places`, `thresholds`, `views`, `skate` segments in its districts, `walks`, `structures`, `reserves` in its districts |
| Code at the wave's base pin | the kit (`src/harbour/horizon/kit/**`), `LightAnchor` adapter, placement helpers, the movers, the host masters, `WorldDefinition` |

## Base SHA rule

- Wave 1 branches from `PIN-2`; each later wave from the previous wave's pin. Branch `claude/horizon-n<wave>-<idA>-<idB>`.
- **No geography change.** A neighbourhood that needs the ground re-cut writes the request in `HANDOFF-notes/land-touchup.md` (location, what, why, which page it breaks). Codex runs one land touch-up after wave 4: `horizon-geo-2`, one presence bump, one Codex trust review.

## Tracks

| Track | Owns | Must not touch |
|---|---|---|
| N-`<id>` (one per neighbourhood) | `src/harbour/horizon/neighbourhoods/<id>/**` (placement, planting, hosts' settings, life, ambience, weather, pastime fixtures), `src/harbour/horizon/world/lights/<id>.ts` | the other neighbourhood's folder; `kit/**` (a kit change is a request to the integrator); `land/**`; `movers/**`; `world/**` except its lights file |
| Integrator | `src/harbour/scene/runtime.ts`, `src/harbour/HarbourWorld.tsx`, `audio.ts`, the district registry, `kit/**` fixes requested by tracks, `src/house/navigation.ts` | `src/core/**`; the presence wire; the Worker |
| Reviewer | `evidence/review/**` | everything else |

All tracks: must not touch `src/core/**`, `src/harbour/data/reading.ts`, `src/harbour/village/layout.ts`, `src/harbour/court/dressing.ts`, `src/harbour/scene/place.ts`, the Desk. The host masters (the seven buildings, the Mandevilla Queen, the chess pieces, Hercules) are placed, never edited (`STYLE §0.4`).

## Must produce (every neighbourhood)

1. **Read the sheet.** The subagent writes a ten-line plan in `HANDOFF-notes/<id>.md` naming, from its sheet: personality, dominant material + accent, roof and silhouette, ground, own flower and trees with tree cover, porch pose, thresholds, sound, best hour, night order, weather, three dressings, must-never-have.
2. **Clearings first** (`STYLE §1.4.1` rule 1): aprons, porches, sightlines, landing fields, lawns, the framed subjects of its pages. Drawn as data before any plant.
3. **Place the kit.** Only kit pieces through the registry. Every threshold in its districts gets a threshold marker and a rack; every junction of walks, trails and the ring gets a milestone; lantern posts and low lanterns where its sheet lights; benches at its porch. No new modelled piece.
4. **Host settings.** Each host master on its pass-1 apron with the sheet's plinth, apron, planting, lights, weather and sound (`STYLE §0.4`); the neighbourhood's dominant material shares a family with its host(s).
5. **Plant** by the grammar (`STYLE §1.4.1`): groves, drifts, the sheet's tree cover, its own flower and tree within 6 eu of every door, trunks visible, rocks following its strata set, the 8–20 m blend band at its edges, no bald rings, nothing on a bed, apron, pad, stair, platform or skate line. All instanced.
6. **Ground** by surface id (`STYLE §1.5`); wet and snow / ice states come from the kit.
7. **Lights in order.** Its sheet's "Night face, in order" as `LightAnchor`s in `world/lights/<id>.ts`, each with its `LIGHT §3` `on` rule; lines sequenced 1 s apart.
8. **Life** (`STYLE §1.9`): only the creatures its sheet and the table place here; ≤ 24 animated per resident district (lite 10); reduced motion perches them.
9. **Its own pastime fixtures** as kit pieces, placed and still (pass 4 plays them).
10. **Sound and weather** per its sheet, as ambience data the integrator wires.
11. **Three dressings authored** per its sheet: materials, roofs, joinery, planting stock and one sign per dressing; at most one friendship bracelet (never central third of a page, never lit); in Taylor at most one concert-light string.
12. **Its Sketchbook pages** (and the extra pages above) at `bestHour` and `also`, Classic, Taylor and Newfoundland, full and lite; and its **porch pose** at its best hour and at 02:00.
13. **Its reviewer checklist**: its `STYLE §2` sheet's boxes plus `STYLE §1.14`, each ticked with the capture that proves it.

## Must not

- Model a piece outside the kit; tint a dressing; paint a cast shadow; add a point light or world-space text.
- Place anything taller than a bench (0.85 eu) inside `protected.green`; place anything on a reserve pad except its hoarding set.
- Change the ground, a bed, a structure or a threshold's position.
- Break a pass-2 ride: every line and route through its districts still rides end to end.
- Let any object near `L01` look like a gauge; let nature read money.
- Its sheet's "must never have".
- Use real household data.

## Tests to add (per neighbourhood `<Id>`)

`test/horizonNeighbourhood<Id>.test.ts`:
- every threshold in its districts has a marker and a rack; every junction a milestone;
- tree cover over unbuilt ground within ±5 points of its sheet's figure;
- no planting instance on a bed, apron, pad, stair, platform or skate line; no unplanted, unpaved band wider than 3 eu around any structure;
- no prop taller than 0.85 eu inside `protected.green`;
- the `LightAnchor` order equals its sheet's night order;
- creatures ≤ 24 per district (lite 10);
- no world-space text; every grounded piece has a contact shadow and ≤ 0.02 eu gap;
- every pass-2 ride through its districts still completes (headless);
- per-district triangles and draw calls inside `CONTRACT §6`.

After each section: `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1`, `tsc`. Final SHA of the wave only: `pnpm build`, then `pnpm test -- --risk=high --focus=harbour --focus-reason="horizon p3 wave <n>: <idA>, <idB>"` within five minutes.

## Evidence required

| Evidence | File |
|---|---|
| Each page it proves × `bestHour`, `also` × three dressings × full, lite; one-line verdict each | `evidence/pages/<page>_<hh-mm>_<dressing>_<full\|lite>.png`, `VERDICTS.md` |
| Porch pose at best hour and 02:00 × three dressings × full, lite | `evidence/porch/<id>_<hh-mm>_<dressing>_<full\|lite>.png` |
| Its night sequence recorded from dusk | `evidence/rides/<id>_dusk.mp4` |
| A fog-day and a rain capture from its porch | `evidence/porch/<id>_<fog\|rain>.png` |
| Seasonal page captures (bud, bloom, fade/seed, snow) in Classic | `evidence/seasons/<page>_<season>.png` |
| The "hide the buildings" test: its porch pose with host masters hidden | `evidence/porch/<id>_nobuildings.png` |
| Value-range and accent probes (`STYLE §1.3.2`) | `evidence/probes/<id>_values.json` |
| Checklist ticked with capture references | `evidence/review/<id>_checklist.md` |
| Integrator, at the wave's end: all twelve pages at `bestHour` and `also`, three dressings, full and lite (`CONTRACT §7`), so no wave breaks another's page | `evidence/pages/all/<page>_<hh-mm>_<dressing>_<full\|lite>.png` |

## Gate

Jonathan per wave: `TEST-PLAN.md` on his Mac and iPhone (walk the porch, stand in each page, dusk to night once, one ride through). The reviewer's BLOCKERs and MAJORs closed first.

## Delivery

`~/Downloads/hearth-horizon-p3-<wave>-<idA>-<idB>/`: bundle (`<basePin>..<branch>`), `patches/`, `HANDOFF.md`, `FINISH-PROMPT.md`, `TEST-PLAN.md`, `evidence/`. Claude does not push.

---

# Part B — The seven applications

## B1 — Little Harbour (wave 1)

- **Sheet:** `STYLE §2.1`. **Hosts:** `home`, `bank`. **Places:** `court`. **Pages:** A, L; C's edge; porch (the square's north-west edge toward the dam `[1140,905]`).
- **Thresholds:** `stairTop`, `quayWest` (`[1453,1277]`: Town Weave parks where it meets Lantern Row, which is pedestrian), `upperStreetSpur`, `gondolaBase`, `floatDock` (`[1520,1275]`, at Lantern Row's east end), the ferry pier `FERRY.piers.landing`; the Terraces' lay-bys (plots 1–3 uphill of the Prow cliff drive, plot 4 on its seaward side pending D12; hoarding from pass 2b).
- **Night order:** Lantern Row (civil dusk, west to east, 1 per s) → the Court's lanterns → the windows of Our home and the Fund bank → the Lamp's beam crossing the harbour → the floatplane's running lights; 23:00 one window per house.
- **Life:** gulls; cats (placeholder tabby until D11) on the quay wall and porches.
- **Pastime fixtures:** the bocce court on the square's small green; the sundial; the fishing spot on the ferry pier; the harbour bell.
- **Extras:**
  - **The square as first screen.** Sign-in lands on the square. The town-arrival signature shot: from the square looking north-west, the dam's glass face and the Crown in frame at golden hour, the square in warm shade (`LIGHT §2`); registered as the arrival pose; nothing taller than 6 eu between the square's north-west edge and the dam line.
  - **Lantern Row's sequence:** the quay's lantern posts light west to east one per second at civil dusk; the first time the island is opened after dark the whole town lights one by one while you watch (`LIGHT §7`, K2 sequencer).
  - **The market stair skate segment** (`skate.S3` segment "Market stair"): three flights, a rail each, the ramp as the ground line; `stairTop` park; ridden end to end on the board after dressing.
  - **The floatplane dock** at `structures.floatplaneDock`: the plane tied up and rocking at night (page L), jetty lamps, bollards.
  - **The gondola base** at the upper street's end: platform dressing, rack, the cabins swinging above the upper street.
  - The harbour bell rings once at noon and answers the summit bell a beat later, quieter (`LIGHT §7`, Grand Plan ch. 3).
  - Our home's window toward the dam.
- **Must never have:** anything taller than 6 eu between the square's north-west edge and the dam line; a flat town.

## B2 — Lakeside, with Stillwater, the Notch and the Green (wave 1)

- **Sheet:** `STYLE §2.6`; the water biome of `STYLE §3.2` for Stillwater and the Notch, the open-meadow biome for the Green. **Hosts:** `glasshouse`. **Places:** `L01`. **Pages:** F, K, A (the dam's face), C; porch (the dam crest, south over the town).
- **Thresholds:** the Dam Gallery door (a stair in the dam, not an Undercroft door); the S1 × walk lakerim threshold at the apron; the Glasshouse spur's end and the Glasshouse steps (ramp twin); the River Run dam portage (`thresholds.damPortage`); S4 × VBS's dismount marker `[874,941]` (`crossings`; the Flats' if pass 1's district bounds put it in `bight`); the Green landing field (`sky.landings.green`, `[1040,1065]` r 60, at the protected centre).
- **Night order:** the Glasshouse glows first (brightest on the island) → the crest lamps → the Dam Gallery door lamp → the moon path on Stillwater. In the Notch: the High Span's three levels each lit by its own kind (road lanterns, shelf strip lamps, walk bollards); the Reach boardwalk's edge lamps.
- **Life:** loons (a pair, open-water months); dragonflies; the heron at the Reach (Apr–Oct), lifting when a board passes.
- **Pastime fixtures:** the skipping-stone shelf on Stillwater; skate arcs on the ice (Jan–Feb, kit state); on the Green, baskets 1–8 of the Nine Baskets course at `pastimeData.nineBaskets`, ringing the protected centre at 172–190 m, all outside `protected.green` (the ninth is the Hollow's, on the covered bridge); the Drop Zone target as paint on the turf at `sky.landings.green` `[1040,1065]`.
- **Extras:**
  - **`L01` is built here** beside the dam at `places.L01`: the only instrument on the island and the only object reading `BasinReading` (`CONTRACT §2.2`). In the same PR the `BasinReading` binding moves off the dam onto `L01`; the dam keeps its constant-level glass face. No new money field, no new calculation. **Codex trust review of this PR is mandatory.**
  - **The Kitty chambers:** per D14 (open; Claude recommends retire) they retire from the dam and are not rebuilt on `L01`; `L01` shows the Fund basin only and the Kitty Banks are read in the Loft as now. If Jonathan answers D14 otherwise, they join `L01` as its reserve chambers, reading exactly the fields they read today. The gauge strip leaves the dam in the same PR that moves the binding (`STYLE §3.1`).
  - No other object on the crest or near `L01` looks like a gauge, meter or level mark.
  - The dam crest plaques; crest parapets both sides with coping.
  - Stillwater mirrors the Crown in calm (`STYLE §1.7`); ice by date (skim Dec 20–Jan 5, full Jan 6–Feb 28, break-up Mar 1–15); its level and colour never change with anything.
  - The Glasshouse at dusk (page K): glazing bars and panes, seed pots in silhouette; no tree between it and the lake; the Glasshouse steps down to the Green with their ramp twin.
  - **The Green:** the protected centre (`protected.green`, centre `[1040,1065]`, r 160) holds nothing taller than a bench; the bur oak is the one authored single tree; the dandelion clocks in June; open views to everything; Hollow Line (S4) crosses it on packed earth with fallen-log kickers.
- **Must never have:** the lake's level, colour or ice following money; any gauge-like object other than `L01`; a prop taller than a bench in the Green's centre.

## B3 — The Crown & the Undercroft, with the Shoulder and the Prow (wave 2)

- **Sheet:** `STYLE §2.7` including the Undercroft rules; sea-cliff strata for the Prow (`STYLE §3.3`). **Hosts:** none. **Places:** `L02`. **Pages:** E, G, J; porch (the lookout wall toward Little Harbour down the gondola line).
- **Thresholds:** `crownLaunch`, the Crown walk at the turning circle, `gondolaTop`, `southPortal` (`[1345,680]`, the Ore Line's top, cart → feet, 29 m from the turning circle with a path between), the Throat (glider only), `deepJetty`, the Adit's mouth, the Sea Door (boat) and `seaDoorJetty` `[1705,775]` (also the Ferry's pier) with the Sea Stair up to the Prow walk, `prowPlatform` (the zip tower's deck at `h` 100, which is also the Prow glider launch).
- **Night order:** the observatory's single warm dot (dusk, the highest light) → the gondola cabins' running lights → underground unchanged (always lit) → Newfoundland aurora Nov–Mar after 22:00.
- **Life:** ravens on the lookout wall; nothing else above the Shoulder; underground only glow-worms and moss.
- **Pastime fixtures:** the summit bell and its rope in the Bell Gallery; the sledding meadow on the Shoulder's south-east side (`pastimeData.sledding`, `[1400,760]`, Jan–Feb, inside the snowline, 90 m east of S1); the Lantern Cave's empty hanging frames.
- **Extras:**
  - **The Undercroft:** every floor on a route at L* ≥ 14 at any hour; every door, threshold, drop edge, rail and jetty edge ≥ 3 : 1 contrast on a 390 px capture, with a chalk lip where light is not enough; three light sources only (glow-worms, lanterns incl. a mine lamp at each of the four doors (the Adit, the Throat, the Sea Door, the South Portal) and each room's entrance, the skylight shaft over the Deep); the skylight shaft at sun elevation ≥ 20° (12 %, dust motes, a pool on the Deep that drifts with azimuth), a 5 % column below 20°; the moon shaft at night; wet stone within 6 eu of water; mine timber sets every 2.5 eu with a lamp every fourth; the Lantern Cave's frames empty on day one, filled in found order by pass 4.
  - **The Adit's mouth** is dressed here (timbers, lamp); the Hollow plants around it.
  - **The Throat:** a dark mouth in shade all day on the north face; glow-worms on its walls.
  - **The Steps** in the Sea Passage (`water_routes.DEEP_RUN.drop`: three 12 m chutes in its first 120 m): glow-worms along the chutes, a mine lamp at each lip, spray cards; page G now looks from the Deep's jetty up the Throat to its daylight mouth.
  - **The Prow, the Needle's Eye, the Stacks** (page J): sea-cliff strata with vertical joints, foam at the foot; the arch's thickness and underside against the rising sun; the Sea Door's jetty and lamp.
  - No tree above the Shoulder (110 m); dwarf spruce below it only (tuckamore in Newfoundland); snowline by month.
- **Must never have:** a tree above the Shoulder; a pitch-black passage.

## B4 — The Hollow (wave 2)

- **Sheet:** `STYLE §2.2`. **Hosts:** `studio`, `cottage`. **Pages:** E (from above); porch (the picnic table under the apples by the covered bridge, toward Scholars' Edge along the garden walk).
- **Thresholds:** `adit` (planting around the Crown pass's mouth), the Hollow Line start (`skateLineStarts` `[1000,520]`), the S4 × garden-walk threshold on the Hollow Bridge `[893,600]` (boards to the rail side at walking pace), S4 × Green Road's dismount marker at the studio terrace `[973,538]`, the studio spur's end `[1000,540]` where Hollow Line starts, racks at the studio and cottage spurs. The studio's door faces west onto its terrace; the Adit is 70 m east along it.
- **Night order:** the kiln mouth glows from dusk → the cottage window → a lantern at each portal of the covered bridge → the Adit's mine lamp → fireflies over the rows (Jun–Aug).
- **Life:** robins and orchard birds (Apr–Oct); cabbage whites (May–Sep); fireflies over the rows (Jun–Aug).
- **Pastime fixtures:** the ninth Nine Baskets basket on the covered bridge (`pastimeData.nineBaskets[8]`, `[893,600]`; baskets 1–8 are Lakeside's, on the Green); "Where's Hercules" spots around the cottage and orchard.
- **Extras:**
  - The orchard: the island's only rows (6 eu, 4.5 eu, following the contour, broken ends, long grass at every row end); the kiln chimney the only tall built element.
  - The covered bridge (Hollow Bridge, `structures.hollowBridge`, on the garden walk and S4, not on Green Road) placed from the kit: sides, roof, underside over the brook, portal lanterns, S4's rail outside.
- **Must never have:** a neat lawn or a regular grid.

## B5 — Scholars' Edge (wave 3)

- **Sheet:** `STYLE §2.3`. **Hosts:** `library`. **Pages:** B and E from a distance; porch (the reading courtyard toward the Flats across the Bight).
- **Thresholds:** the Library spur's end (wheels → feet), the garden walk's start, the cove walk (`walks.coveWalk`, from the Library down to the Scholars' cove ferry pier `FERRY.piers.scholarsCove`, crossing Horizon Drive at a threshold `[686,313]`).
- **Night order:** the Library's tall reading-room windows → low bollard lanterns along the garden walk (knee height, 2 eu pools) → the courtyard lantern with its moths → the Ferry's running lights below on the Bight.
- **Life:** chickadees on branches and the courtyard wall; moths at the courtyard lantern (May–Sep).
- **Pastime fixtures:** none of its own; lantern spots are pass 4's.
- **Extras:** the densest canopy (60–70 %) with a glade every 60–80 m; visible light-shaft cards (8 %) between trunks at golden hour; duff under the trees, never turf; the courtyard open to the Bight; fog density × 1.3 under canopy; Newfoundland black spruce and balsam.
- **Must never have:** open lawn, saturated warm colour, or a view without a trunk in the foreground.

## B6 — The Landing & Long Sands, with the Reach (wave 3)

- **Sheet:** `STYLE §2.5`; the shore biome of `STYLE §3.2`, the water biome for the Reach. **Hosts:** `boathouse`. **Places:** `campfire`. **Pages:** D, L (the Boathouse across the water), I (Reach boardwalk); porch (the Boathouse dock across the river mouth to the quay).
- **Thresholds:** `boathouseDock`, `landingQuay` (the Summit to Sea finish on the islet between the Reach's west channel and the river, reached over the Reach boardwalk), `zipLanding` (the landing tower `[1130,1440]`: deck `h` 12 over the Town Weave boardwalk, a stair and a ramp to the sand), the Reach meadow landing field (`sky.landings.reachMeadow` `[1230,1190]`, the Dam Run's end), the Reach walk × Horizon Drive threshold `[1367,1271]`, Tideline park, the ends of Town Weave and Hollow Line (the Dune Culvert on Hollow Line), the Campfire, the Lamp's jetty (`lampDock`) and `lampGallery`.
- **Night order:** the Boathouse window → the Lamp's beam over the water → the Campfire (21:00–01:00, or when the Chapter is open) → fireflies within 30 m (Jun–Aug) → the moon path on the sea.
- **Life:** gulls; cats on the Boathouse dock; fireflies at the campfire; the heron at the Reach (Apr–Oct), lifting when a board passes.
- **Pastime fixtures:** the kite field on Long Sands; paper-boat landing at the tide line; the log ring at the Campfire (kept as the monthly Chapter, unchanged).
- **Extras:** wrack line and footprints; dunes throwing long shadows at both ends of the day; wind-bent pines behind the dunes only, leaning with the wind; Town Weave's dune-crest boardwalk and the dune walk at the beach foot; the Tideline park dressing; the zipline cable sagging to its landing tower on the dune crest; the Landing quay's run-out and bollards; the river mouth reaching the sea past the Quay Bridge; the lighthouse (kit) on the Lamp islet with its 8 s beam; the Wreck on its reef.
  - **The Reach** (page I): reeds at hand height above the rail line, the decorative spring (`water.spring`, not the Deep's outflow), the heron; the Reach boardwalk and footbridge; the Quay Bridge's west arch seen from the Boathouse; Newfoundland adds bakeapple and pitcher plant.
- **Must never have:** a clean empty beach; anything tropical.

## B7 — The Flats, with the Bight (wave 4)

- **Sheet:** `STYLE §2.4`; the shore biome of `STYLE §3.2` for the Bight. **Hosts:** none. **Pages:** H, B; porch (the hangar's bench toward the Bight Bridge and Long Sands).
- **Thresholds:** `strip`, `balloon`, the Wash Run's start (`skateLineStarts` `[480,480]`), the Flats ferry pier, the Bight pier (`FERRY.piers.bight` `[560,890]`, reached by `walks.bightPier` from the Flats trail across Horizon Drive `[407,894]`, the Wash Run `[509,896]` and a plank footbridge over the Wash mouth), `bightShoreJetty`, S2's dismount after the Bight Bridge (`crossings`, `[660,1170]`), the Wash Run's wet-day closure marker (six hours after drizzle).
- **Night order:** the windsock's red lamp → runway lamps in two rows, lit from the threshold end (pass 2 anchors) → the hangar door lamp → the balloon's burner glow when it rises. The darkest surface neighbourhood: the most stars.
- **Life:** swallows over the strip (May–Aug); hawks circling in the thermals 12:00–18:00; sulphurs (Jun–Aug).
- **Pastime fixtures:** none of its own beyond the strip and the balloon.
- **Extras:** ≥ 70 % open ground; tree cover ≤ 3 % in clumps of 3–5 in the lee of rocks; the one wind-shaped pine by the hangar; nothing tall in the strip's approach; the Wash reads as a bowl with cracked ochre plates; the windsock always agrees with the cloud drift; the Bight Bridge's west landing.
  - **The Bight:** its shores, eelgrass, the sandbar at full moon (`LIGHT §7`); the Bight Bridge's trestle and S2's rail-side lane; Bight Shore's hoarded plots (pass 2b; `reserves.bightShore`, each at its own `rot_deg`) with wildflowers and a bench, the re-laid VBS spur and the Bight shore trail behind them; the Bight pier and the Bight Shore jetty; the Lamp Hop's landing on the Bight water beside the sandbar.
- **Must never have:** trees in a line, anything tall in the strip's approach, or lush green.

## The land touch-up (after wave 4)

Codex applies every request in `HANDOFF-notes/land-touchup.md` that the design lead approves, as one geography revision `horizon-geo-2`: re-bake the terrain asset, bump the presence `world` string (browser and Worker, Codex trust review), migrate saved positions by `geo`, re-run pass 1's tests and the twelve pages. Then `PIN-3`.

## Reconciled to MANIFEST v1.1 (reviewer)

- District table rewritten from the v1.0 pass-1 proposal (`notch-reach`, a separate `undercroft`, twelve districts) to `MANIFEST.json → districts` (13; the Undercroft the Crown's child; `offshore` without a neighbourhood). Consequences: the Green moves from the Hollow (B4) to Lakeside (B2); the Reach and page I move from Lakeside (B2) to the Landing (B6); the Bight moves from the Landing (B6) to the Flats (B7); the Nine Baskets split (1–8 on the Green, Lakeside; 9 on the Hollow Bridge, the Hollow); the Drop Zone target goes with the Green.
- B1: `quayWest` described as Town Weave's quay threshold (the race no longer finishes on the town quay).
- B2: the Kitty chambers default inverted to match D14 ("Claude recommends retire") and STYLE §3.1; protected radius 200 → 160.
- B3: "the Ore Line's Crown station" → `southPortal`; "the Dam Gallery's top in the Bell Gallery" removed (the Dam Gallery no longer enters the Undercroft); `gondolaTop`, `deepJetty`, `seaDoorJetty` named; the four doors listed; the skylight is the shaft over the Deep; sledding cited from `pastimeData.sledding`.
- B4: the S4 × garden-walk crossing is the Hollow Bridge threshold at `[893,600]` (not `[930,660]`); the S4 × Green Road crossing moves to B2.
- B6: `landingQuay`, `zipLanding`, `lampDock`, `lampGallery` named; the spring is decorative, not the Deep's outflow.

### v1.2 deltas (reviewer, MANIFEST v1.2)

- B1: `quayWest` at `[1453,1277]`, floatplane dock `[1520,1275]`, Terraces plot 4 seaward (D12).
- B2: protected centre and Drop Zone at `[1040,1065]`; baskets 1–8 ring the centre; the Green's S4 crossing is with VBS `[874,941]` (S4 × VG moved to the studio terrace, B4).
- B3: South Portal `[1345,680]`; Sea Stair; the Prow tower deck shared by zip and glider; sledding `[1400,760]` Jan–Feb.
- B4: S4 × VG `[973,538]` and the studio spur threshold; studio door text.
- B5: the cove walk and its V01 threshold.
- B6: S1 finish on the Reach islet; the zip landing tower; the Reach meadow landing field; the V01 × Reach walk threshold; the river mouth.
- B7: Bight pier `[560,890]` and its walk; S2 dismount `[660,1170]`; the Wash Run's wet-day closure; per-plot rotations; the Lamp Hop landing.
- B3 extras: the Steps in the Sea Passage and page G's new framing (up the Throat).
- B7: S2's v1.2 label, the Wash Run.


## Refined for SCALES.md
- **The first screen is the Journey map**, not the square (CONTRACT rule 15). Little Harbour's "first screen" work becomes the *arrival* work: the square is where the default zoom-in lands, and the town-arrival signature shot is that zoom's last frame. Everything else in this brief stands.
- **The homestead** (`MANIFEST.json → journey.homestead`) is dressed in the Little Harbour pass with the kit's homestead cards: the kitchen garden's five maturity states, the landing's cargo, the workbench, the pavilion's three states (stakes / ready / with its memory flag), the timber crossing's wear states (Healthy, Strained, Damaged, Recovering) on the footbridge over the town channel, the Kitty plaza's six sculpture positions. Their *logic* is pass 02c's; this pass places and draws them.
- **Stations:** each neighbourhood pass dresses its station pads (the waymark, the first row's edging, the tent card position) and checks that a full station (20 beds) fits its pad without touching a walk.
