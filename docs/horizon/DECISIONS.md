The live Horizon decision register is [docs/DECISIONS.md](../DECISIONS.md#the-horizon--decisions-d1d33-pass-0-reconciliation-2026-09-25).

## Stage A rulings (Jonathan, 2026-09-27)

Jonathan answered the Stage A `DECISIONS.md` on 27 September 2026 (01:30 America/Toronto). Group A was answered item by item; groups B and C "recommended on all". The data is in MANIFEST v2.0 (`README.md` → "v2.0 (Wave 5, Jonathan's rulings 2026-09-27)").

Decided by Jonathan, 2026-09-27:

| Id | Decision |
|---|---|
| D-A1 | Bight Bridge option 1: 245 m, one 36 m steel-arch navigable opening over the ferry lane, timber viaduct kept, abutments on the headlands to the ground; upgraded: a lookout bay at the arch crown, S2 a continuous skate ribbon on the deck with a banked east descent and a ramp from the Wash, ≥ 2 trick spots on the bridge, every deck edge railed, no pad on the deck, ferry beam 8 m. |
| D-A2 | ZIP × G1 option A: the zip passes under the gondola (30.45 m); nothing moves. |
| D-A3 | Gondola top station option 2: [1335,535], deck 150 at grade; towers re-solved, no 300 clamp; summit journey target 205 s. |
| D-A4 | Prow Tunnel candidate A at ≈ [1590,890], built as a covered gallery; cover reported honestly; headroom ≥ 5. |
| D-A5 | Dam face stays due south; at golden hour the glass is lit from inside (a light card); LIGHT §2 and P25 re-worded. |
| D-A6 | All eleven v1.7 Sketchbook poses accepted (K re-posed under D-B2). |
| D-A7 | VG × walk garden: a named footbridge; #34, #17, S4 × walk garden, S1 × dam portage: flush at-grade thresholds. |
| D-A8 | Keep five moved Year Walk stations; November back onto solid ground on the Prow top. |
| D-C11 | Market stair: stairs only; the ramp twin retired; the 295 eu detour is the recorded step-free route. |

Recommended, accepted 2026-09-27 (Jonathan: "recommended on all"):

| Id | Decision |
|---|---|
| D-B1 | The Crown stays off page A (page E holds it). |
| D-B2 | Page K re-posed so the Glasshouse is in the 16:9 frame. |
| D-B3 | Page H's best hour → golden hour. |
| D-B4 | Walking speed 2.4 m/s stays until Jonathan walks it on a device. |
| D-B5 … D-B13 | Kept as made (the Throat dark, the register from the bake, the lower route kept open, the Bight trail as VBS's footway, the Inlet Footbridge at 55, the two fins, the hangar bay 11 × 18, the Year Walk pad heights, the working quay). |
| D-C1 | The Notch: the gorge starts ~70 m below the dam with the forecourt open (page A wins). |
| D-C2 | Page A phone: a railed (open) parapet on the dam-gallery stairwell. |
| D-C3 | Keep the Throat collar; the passage's aperture is the built 10.8, the 18 m is the mouth's. |
| D-C4 | P29 measured on terrain + structures with the plaza slab checked; correctly unlit walls accepted. |
| D-C5 | "The Reach water" includes the river where it crosses the Reach. |
| D-C6 | L01 ≈ 1 m east onto solid slab. |
| D-C7 | The turning circle: one lane re-routed (the Crown walk joins the Year Walk lane). |
| D-C8 | Plot bight.1 moved south-west off the June lane and S4 (25 m on the bake; the ≈ 12 m estimate did not clear). |
| D-C9 | VBS beside/over S4: a named trestle. |
| D-C10 | The Hollow neck stays reserved. |
| D-C12 | The 40 m rock cut at Horizon Drive's north-east corner accepted. |
| D-C13 | The Lakeside switchback accepted for the greybox. |
| D-C14 | The cove walk comes down by a cliff stair. |
| D-C15 | S1's self-crossing: a named skate flyover. |

## Design-lead calls in the Wave 5 integration (MANIFEST v2.1, 2026-09-27)

Made by the design lead (integrator 3) on the merged Wave 5 bake, inside Jonathan's rulings; each is reversible and keeps its v2.0 value in the manifest (`v2_0_*`). Numbers: `README.md` → "v2.1".

| Id | Call | Why | Reverse by |
|---|---|---|---|
| D-A1 (opening) | The Bight Bridge's navigable opening is **40 m at s 103–143** (Jonathan ruled 36 m). | An 8 m ferry hull cleared the east arch pier by −3.99 eu at 36 m (s 98–134); 40 m gives +1.37 past both piers. The best 36 m (s 105–141) clears by only +0.15. | `structures.bightBridge.opening.v2_0` (or 36 m re-centred to s 105–141, or a local bend of the FERRY line). **For Jonathan.** |
| D-C8 (distance) | Plot bight.1 sits **25 m** west-south-west, not the ≈ 12 m he accepted. | ≈ 12 m still leaves 12 + 55 Year Walk samples in the plot; [814,919] is the nearest clean spot (W5-DATA). | `reserves.bightShore.plots[0]`. **For Jonathan.** |
| D-C11 (step-free way) | The step-free way between the square and the upper street is the **square walk** (94 eu at ≤ 8 %), not the 295 eu detour. The stair stays stairs only. | W5-A narrowed the upper-street terrace (x 1463–1480) so the square walk climbs beside it. | Restore `TOWN_TIERS` (land/town/build.ts) and `marketStair.v2_0_stepFree`. **For Jonathan.** |
| page A (bank) | The Fund bank's greybox is 20 × 18 (was 26 × 18), its east wall and door side kept. | Its south wall hid 36 of the Shoulder's rays from the square: 8 → 33 px at 1440 × 900. | `hosts[bank].v2_0_footprint_m` / `v2_0_xy`. |
| page D (Lamp) | The Lamp leaves Pass 1's frames for page D; a Pass 2b subject. | 670 eu from the eye and 9 px of 13 by size alone. | `views.D.v2_0_subjects`. |
| page H (portrait) | The portrait eye stands 12 m west on the strip ([428,760]). | West sea 1 → 14 px at 390 × 844. | delete `views.H.portrait.xy`. |
| Year Walk (Feb) | The lake-rim trail takes the Year Walk's section (5.2 m + 1.2 m shoulders). | The Year Walk shares it at offset 0; its edge stood outboard of the trail's rails for ≈ 118 m. | delete `walks.lakerim.surface_m` / `shoulder_m`. |
| D-C9 (length) | The VBS trestle runs 12 m further south, to [886.7,916.0] (56 m). | VBS hung 7.0 → 3.1 eu over the ground there. | `structures.bightSpurTrestle.v2_0_to`. |

## Mountain v2 placement rulings (D-M1…D-M10, pass 5, 2026-09-28)

Jonathan, 28 September 2026: *"There is a particular charm, asset quality, and sense of composition in Mountain V2 that I want to preserve … I am comfortable bringing a slightly stripped-down version of the actual Mountain V2 into Horizon and using it as the standard we expand from … 'Stripped down' means less visual noise — not less care, weaker assets, flatter materials … Roads, mountains, trees, the dam, bridges, and the gondola … Empty space is part of the result I want … It should feel like a beautiful region that belongs in Horizon — not a legacy exhibit pasted onto it … do not interpret this as permission to turn the entire island into Mountain V2's biome … We are advancing Horizon's existing foundation to a higher visual standard — not discarding it … Build a convincing first region, then extend the standard outward … Horizon receives the full picturesque scene. Journey receives its clear, geographically accurate representation."* He also ruled to push and merge if possible. Full brief: [`passes/05-mountain-region.md`](passes/05-mountain-region.md).

The pass keeps `horizon-geo-1` (the Horizon is not pinned and no household has a saved body on it; `CONTRACT.md` §2.14 applies from PIN-1). D-M6b (a Little Harbour → v2-quay lower gondola leg) is open, not built here.

| Id | Question | The number that matters | Ruling | Retires | Status |
|---|---|---|---|---|---|
| D-M1 | Where does v2 stand on the Horizon? | summit on the Crown summit `[1310,470]` h 158; town foot at h 54 on the Stillwater terrace east of the lake | v2 stands 1:1, its own authored geometry under one translation (`MOUNTAIN_V2_OFFSET` = native + `{x:1308,y:54,z:764}`) | the Crown station at `[1335,535]` (v2's summit station takes over) | Jonathan, 28 Sep 2026 |
| D-M2 | Whose ground wins where v2 and the Crown's own land meet? | south of v2's summit line (native z ≥ −294) v2's ground wins inside its footprint; north of it the higher of v2 and the Crown's own north face wins; feather 40 m at the footprint edge | as stated, so the Throat, its collar and the skylight keep their cliff | — | Design lead (this brief) |
| D-M3 | Which structure holds the Fund's one picture? | `L01` moves to v2's dam crest plaques (native `DAM_PARTS.promenade[6]` + offset) | v2's glass dam is the one Fund picture; Stillwater drains over a natural rock sill into the Notch | the Stillwater dam, apron, gallery, `damPortage` | Jonathan, 28 Sep 2026 |
| D-M4 | What carries wheels to v2's foot? | new spur **V03 "Mountain Road"**, from Horizon Drive's Prow cliff drive (near the Terraces lay-bys) to v2's road foot | v2's own road is the mountain's road | Crown Road (`V02`), the Shoulder Tunnel | Design lead; confirm |
| D-M5 | Where does S1 Summit to Sea run on the mountain? | upper half = v2's race course (its road, 17 gates, named segments, the quay finish at v2's foot); the Horizon S1 continues from there to the sill, the Notch shelf, the Reach and the quay | as stated | the Shoulder sweep, the seven-leg Lakeside ramp, the sledding meadow bed, the Cup tarn | Design lead; confirm |
| D-M6 | Which gondola line serves the mountain? | G1 = v2's gondola (quay station at v2's foot → summit, three towers, gorge reveal) | as stated | the Crown station at `[1335,535]` (folded into D-M1's retirement) | Design lead; confirm |
| D-M7 | Where does the Ore Line's South Portal land, and what happens to the Undercroft? | the South Portal drops to v2's ground at its position | the Undercroft rooms are unchanged (all ≥ 40 m below the new surface) | — | Design lead |
| D-M8 | What is not drawn in this pass ("stripped down")? | the brief's §4 drawn / not-drawn lists | source stays; nothing is deleted from `src/harbour/mountain/**` | the items in brief §4's not-drawn list (scenery only, not the source) | Design lead; Jonathan may add or restore items |
| D-M9 | Are v2's four tool buildings drawn? | 0 of 4 | v2's tools live in the Horizon hosts; their terraces stay as open shelves; the observatory (`L02`) and the goal pavilion (as a plain shelter) are drawn | v2's home, cottage, library and glasshouse buildings (their terraces are kept) | Design lead |
| D-M10 | How far are pages A, E, F, G re-posed? | only as far as the new ground requires | old values kept as `v2_5` | — | Design lead; Jonathan confirms by eye |
| D-M11 | What stands on the ring of high ground round v2 (Mountain V3)? | Glacier Peak 156 (under v2's 163.24, ceiling 157); the glacier in its cirque (floor 135, ice crown 143) feeds every V3 stream; nine uneven benches (61.5–117); six falls (Veil 48 m, Rillcut 51 m, Long 52 m, Spur 36 m, Stair 14 + 16 m); the Rim Tunnel on V01 at `[1566,545]` (84 m) under the Rim Bridge | the Highlands and the Falls: one landform and water definition in `land/mountainV3/`; v2's land south of its summit line untouched, north of it the higher wins (D-M2); every Horizon walk on v2's land is region-carried (the D-M5 rule generalised); the confluence rule (two aquatic routes within 6 eu meet, they do not cross); a fall's lip is where water leaves the ground (no bank there); the Year Walk's Hollow east-edge stretch moves ~20 m west for the plunge pools; the lake-rim trail is pinned level across the Veil Footbridge | — (nothing retired; the Shoulder band's west failures are now V3 ground) | Jonathan, 2026-10-04 ("build it, improve where it lacks"); book [MOUNTAIN_V3.md](MOUNTAIN_V3.md); names, buildings, map glyphs and a V3 view page are open calls |

## The Water's Way (D-303, D-WW1…D-WW42, 2026-10-05)

Jonathan, 5 October 2026: *"recommended on all"* on the plan [`STORY.md`](STORY.md) and every open call from the seven neighbourhood prototype chats. The dated entry is D-303 in [docs/DECISIONS.md](../DECISIONS.md); the one definition is `src/harbour/horizon/world/story.ts`. Names are proposals.

| Id | Decision | Where it lands |
|---|---|---|
| D-WW1 | Adopt "The Water's Way": places 1–7 in story order (the Highlands, the Green, the Reach + Greenway, Little Harbour, Long Sands, the Flats & the Bight, Scholars' Edge), hours dawn → before dawn | `world/story.ts` `STORY_PLACES`; STORY §2 |
| D-WW2 | Never "Chapter" for places in the app (a Chapter is a month) | STORY §1; registry test |
| D-WW3 | Dress the Hollow as the interlude in the same program | PR 3; STORY §5 |
| D-WW4 | The second stream: the Hollow Tarn into Orchard Brook | PR 2 land |
| D-WW5 | The evening relay (civil dusk, 40 s, emissive cards), three noon bells (Westwatch → summit → campanile), the Lamp as every binocular's target | `EVENING_RELAY`, `NOON_BELLS`; PR 5 |
| D-WW6 | Warm coast for Little Harbour + Long Sands; no palms in the Reach; the fit edits (Boathouse white/terracotta, one island lantern, bluff-end pines, juniper → spruce, verdigris cote, dry-stone from the north pass, Glasshouse stair, Fallswatch on the buttress, Green Road bollards) | STYLE §2.0; STORY §6 |
| D-WW7 | V3.1: one ridge system, benches as shelves on spurs | PR 2 land |
| D-WW8 | Horn under v2's summit (≤ 156), top 30 m steepened (~1:0.7), two arêtes, ~20 m cirque headwall | PR 2 land |
| D-WW9 | Veil amphitheatre cleared; Spur-crown bench 15 m north; west buttress 10 m west of the portal trench; Fallswatch on it | PR 2 land; STORY §4.2 |
| D-WW10 | Bench Hamlet a real shelf ≥ 60 × 35 m at ≤ 8 % (nine crofts with yards) | PR 2 land |
| D-WW11 | Drag lift kept: structure now, ride in PR 5; STYLE §2.7 allows it | STYLE §2.7 |
| D-WW12 | The swing and kites count as tree and sky | STYLE §1.4.1 rule 12 |
| D-WW13 | No treehouse | STYLE §1.4.1 rule 12 |
| D-WW14 | The Old Oak at [1125,1165]; the Meadow Pavilion [848,1060] and the windpump [908,1245] added | PR 3 Green |
| D-WW15 | Green Road's lanterns inside the circle → 0.8 eu bollards; rule 12 names the road | STYLE §1.4.1 rule 12 |
| D-WW16 | Glasshouse stair-and-ramp down the scarp | PR 2 land |
| D-WW17 | Baskets 4, 6, 7, 8 off the beds (#8 ~[1000,935]); Drop Zone target ~10 m ESE | PR 3 Green |
| D-WW18 | Open timber rails on the Reach boardwalk and bays (S1 checked) | PR 2 land; STYLE §1.6 rule 10 |
| D-WW19 | Page I to the boardwalk's north end; night line the High Span's lights; "the drawbridge" | PR 5 |
| D-WW20 | Six Reach lookouts and the osprey pole (new pads, the Channel Hide) | PR 2 land, PR 3 Reach |
| D-WW21 | Binoculars with a free lever, no coin | STYLE §3.1 Lookout kit |
| D-WW22 | The Greenway: 6 m deck, ≤ 5 %, `greenway` profile, three bridged crossings in the register, Bluff End dead-end lookout | PR 2 land, PR 3 |
| D-WW23 | Scraped pools ≤ 0.3 m, the Reed Maze, the Marsh Hide, floating reed rafts | PR 2 land, PR 3 |
| D-WW24 | Rail 1.05 on the high deck | STYLE §1.6 |
| D-WW25 | STYLE §2.1 → "cobblestone Italy"; Taylor/Newfoundland skin the same massing | STYLE §2.1 |
| D-WW26 | Square view retargeted to v2's dam; the belfry is the dam view; the bank stays | page A; PR 3 Harbour |
| D-WW27 | Town Weave 8 m inland at the quay (3B) | PR 2 land |
| D-WW28 | New pages (belfry N, over the roofs, from the water) + the Giro del Porto route | PR 5; MANIFEST |
| D-WW29 | Single-device bocce and passeggiata; shared play waits for a presence plan + trust review; cats placeholder (D11 open) | PR 5 |
| D-WW30 | Long Sands Direction B; STYLE §2.5 rewritten; D-R4 settled for palms (west of the Quay Bridge only) | STYLE §2.5 |
| D-WW31 | The pier and the Ferris wheel as drawn (ferry line and `sands` landing checked) | PR 2 land, PR 4 |
| D-WW32 | Storefronts: collidable facades with shallow porches, not hosts | PR 4 |
| D-WW33 | Page D night pose; Boathouse gable lantern for page L; the Wreck at [250,1150] | PR 4, PR 5 |
| D-WW34 | The hybrid airport: elevator + beacon, Quonset the one hangar, timber station, geoglyph, stargazing deck + observatory, arch + Wash hoodoos, tallgrass/steppe | STYLE §2.4 |
| D-WW35 | Windsock out of the approach (design lead: [466,508]) | PR 2 land |
| D-WW36 | Page H's tested pose; porch frame reworded | PR 5 |
| D-WW37 | Bight Shore plot walls battered and planted | PR 2 land |
| D-WW38 | Scholars layout B (courtyard on the SW gable, sun-window glade) | STYLE §2.3 |
| D-WW39 | The Bight lookout spur as the porch pose, deck raised ~2 m | PR 2 land, PR 4; STORY §4.2 |
| D-WW40 | 60–70 % canopy with instanced cards for the back rows | PR 4 |
| D-WW41 | (design lead) The canonical story points, eyes and sight-chain contract (≥ 0.5 m to top − 2 m, baked solids included) | `world/story.ts`; STORY §3–4 |
| D-WW42 | (design lead) The thirteen prototype-conflict rulings (baskets, Oak Clock, windsock, no lettering, drag lift, hamlet, glacier, Boathouse, Long Sands ramp/headroom/bowl, harbour lantern/bocce, Scholars pad/deck, three dressings, the Lamp) | D-303 entry |

### PR 2 · L1 — the Highlands V3.1 landform and the second stream (D-WW50…D-WW59, 2026-10-05)

Land builder L1 under D-WW4, D-WW7…D-WW11 and the design lead's rulings (D-WW41/42). One definition: `land/mountainV3/{landform,water}.ts`; the manifest block "V3.1" in `make_manifest.py`. Proofs: `test/horizonLandWWHighlands.test.ts`, `test/horizon-mountain-v3.test.ts`, `test/horizonStorySightChain.test.ts`.

| Id | Decision | Where it lands |
|---|---|---|
| D-WW50 | One ridge system: the crest `rim.north` → `rim.col` (narrower, steep-sided over the Throat's head and the col north of Glacier Springs, so it lifts neither the coast drive's cutting nor the Crown Rill's bank) → `glacierPeak.north` up the horn's north ridge to the east arête's shoulder [1412,386]. Three spurs fall south off it (`spur.westwatch`, `spur.hamlet`, `spur.orchard`), each lifting only its own crest (≤ 2.5 m within 10 m of its spine, never a mound over the flanks); Westwatch's knoll, Bench Hamlet, the spur crown and Orchard Bench are shelves on them, the Twin Tarns shelf on the hamlet spur's east flank. Rill gullies: four dry V cuts (three on the crest's north flank, one on the west wall) beside the water gorges | `V3_RIDGES`, `V3_SPURS`, `V3_RILLS` |
| D-WW51 | Stepped strata in the definition: on V3's own ground (never v2's footprint, never within 8 m of a fall's lip) every slope over 0.55 terraces toward 3.2 m beds (a riser over the middle 70 % of each bed, a ledge at its top), weighted 0.55 at slope ≥ 1. The layer reads the local slope through a sampler of the Horizon's ground before V3 (`baseHeight` passes it). The 5 m bake lattice resolves the beds only where a cliff is gentler than ~0.6; steeper faces carry them in the definition for finer meshes and the dressing | `V3_STRATA`, `strataStep`, `mountainV3Height(x, z, h, pre)` |
| D-WW52 | The horn: summit 156 (V3 never raises past it; `V3_CEILING` 157 stays the hard limit), a cone at `HORN.face` 1.6 through its top 30 m with two sharp arêtes (blend 3): the east arête to the col and the **south-west arête** to the glacier's east lip. The second arête's direction: it stands across both lines of sight (the Rim Walk's east end sees the horn bearing SSE, Rim Lookout bearing NNW), so the horn shows two skylines from each; a north-east arête would run into V01's cutting at y 70 and be foreshortened from Rim Lookout. Within 40 m of the summit v2's north apron takes V3 in full (the summit sits on the footprint line; the apron's ¼ weight had cut the horn at the line). The cirque's headwall is the horn's west face over the ice | `HORN`, `hornHeight`, `V3_RIDGES` |
| D-WW53 | Bench Hamlet: a rounded-rectangle shelf (superellipse 4) 72 × 44 m about [1078,416], long axis NNW–SSE, graded 4 % down to the north toward the lane from Westwatch; the west ledge narrowed to the wall (80, 12 m wide) and the lower field moved to the west rim; the Rillcut re-routed down the shelf's east edge (split to the Long Beck at [1094,466]), the Hamlet Footbridge moved to [1103.3,420]; the Bench Hamlet place pad moved off the lane to the shelf's south half [1080,440] (its edge stood 0.54 over the climbing lane, a step both ways) and the lane pinned level onto Orchard Bench at 117 (it ended 3 m under the orchard place's pad) | `bench.hamlet` `shape`/`grade`; `gorge.rillcut`; `water.v3.rillcut`/`longBeck` |
| D-WW54 | The Veil: one amphitheatre — an upper bowl behind the lip, a U below it (superellipse 3, the back wall's face at z 699.5–702.5, south of it the floor at the pool's rim), a flat-topped west buttress (top 97) west of the lip and the knife-edge east buttress over v2's Foot; the spur crown pulled 15 m north (and narrowed on the east so it never fills the valley below the spur); Fallswatch on the west buttress: a 10 × 5 deck (95.3) along the buttress's cover ridge over the Stillwater tunnel (5 m wide between the road's cuts) at [1082,692.5], the story eye at its south-east corner [1086,694.3], its lane over the Veil outlet on the Lip Footbridge (deck 96.5) | `VEIL`; MANIFEST `places.fallswatch`, `walks.fallswatch`, `structures.lipFootbridge` |
| D-WW55 | The second stream: the Hollow Tarn re-levelled 44 → 40.5 (the Hollow Rill steepened to it) and its outlet, the Hollow Beck, runs west under Green Road and its footway lane (Hollow Beck Bridge, one 17 m span) and the Year Walk's Hollow lane (Hollow Beck Footbridge) into Orchard Brook at 37.4; three register rows | `water.v3.hollowBeck`; MANIFEST `structures.hollowBeckBridge`/`hollowBeckFootbridge` |
| D-WW56 | The drag lift, shortened under ruling 5: the cirque's west rim is inside the skylight keep-out and on v2's north land, and every straight line from the Twin Tarns shelf toward it crosses the skylight box, v2's land or the Crown Rill's corridor (the Rim Walk lies in a 7–15 m cutting there). Built: the Twin Tarns shelf [1144,404] → the hamlet lane beside Orchard Bench [1192,355.6], two towers, both stations threshold pads on walks (`liftFoot` joins the Fallswatch lane). The full glacier line needs v2's north land or the keep-out lifted — a Jonathan call | MANIFEST `structures.glacierLift`, `thresholds.glacierLift*`, `walks.liftFoot` |

### PR 2 land, L2a — the Reach and the Greenway (D-WW60…D-WW69, 2026-10-05)

Built on `claude/waters-way-common` @ 0b2dea0 from the Reach prototype (`/protos/reach` SPEC + LAND-ASKS) and the regenerated Greenway line (route-e / prof-e on bake 0b2dea0). Land only; dressing (planting, viewers, lamps, rafts, the osprey pole, the gateway frame, the pavilion) is PR 3. Names are proposals.

| Id | Decision | Where it lands |
|---|---|---|
| D-WW60 | **One open-rail rule.** A solid of kind `openRail` (and the road main's timber `corridorGuard` collider) is an open rail: posts ≤ 2 m apart and bars, 1.05 high, real closed prisms at their drawn height (collision is what's drawn), with a **guard bar 0.14 × 0.10 centred 0.65 over the deck** — the runtime's body-contact level (`runtime/geography` probes a body at 0.2, 0.65 and 1.25; anything under the 0.48 step is a lip it steps over, so a post-and-thin-bar rail let a body through between posts) — 0.01 proud of the posts so a body pressed along it slides (the Reach Footbridge slide walk); the kicker stays the wheel/board lip; `world/raycast.ts` sees through it — so the Sketchbook view proof and the story sight chain both do. Solid rails and parapets stay opaque. | `land/structures/openRail.ts` `isOpenRail`, `openRail`; `world/raycast.ts` |
| D-WW61 | **The Reach's rails are open timber** on their baked lines: the boardwalk (S1's deck, ±1.875), the Reach Footbridge (its 1.15 stone parapet cut Spring Bay → the campanile), Spring Bay and Harbour Bell Landing (the bays' baked boundaries — the prototype's r 3.05 / 3.65 arcs overhang the baked bay decks by up to 0.5 m, so the rail follows the deck it guards), the High Span Overlook (0.1 inside its deck). The story registry drops `owedOccluders: ['reachFootbridge.rails']`: Spring Bay → campanile is a plain passing proof. | `SpanSpec.openRail`; `bridges/build.ts OPEN_BAYS`; `highSpanLevels`; `world/story.ts` |
| D-WW62 | **Notch Bluff and Sunset Rail** are stone pads 7.4 × 5.4 facing their views, tops 23.50 / 11.09 (the prototype's measured max ground + 0.12), plinths whose foot corners settle to the final ground, a 0.35 sitting kerb (0.52 coping) on the front and sides, the open rail 1.05 over the pad on the kerb, and a 1.8 gravel stub — an ordinary walk bed (its bed geometry is the gravel deck) on a corner-settled skirt, no terrain cut, so the bluff edge is not blended — to the road's paved edge (Notch Bluff's west of the High Span's deck end), step-free; the path graph tees it to the road and the corridor opens its kerb there (an entrance). Register: a documented junction row each (no marker on the carriageway). | `land/structures/reach.ts`; MANIFEST `structures.notchBluff`, `.sunsetRail`; register |
| D-WW63 | **The Channel Hide** stands off S1's deck at s 56.2 (4.6 × 5.0 bay on six piles, floor 5.0, a 2.3 blind slotted west and south, solid north, roofed). Its connector opens the boardwalk's west rail over exactly s 54.4–58.0 (the ordinary kerb-gap rule). **S1 skate guard:** a 0.2 timber sill across the gap on the rail's line — a wheel cannot roll a lip over its stepMax (board 0.12; the kernel treats it as a wall), a walker steps 0.48 — Its bed tees onto the deck from inside the west edge (it never meets S1's centreline, where the west channel crosses under the deck — a dismount pad there would share the channel crossing's unbuilt proof); the register row documents the junction. | `reach.ts channelHide`; register `S1 × channelHide` |
| D-WW64 | **Page I** moves to the boardwalk's north end (eye [1247.5, 5.98, 1218] → [1250, 5.7, 1184], fov 55, morning / dusk; subject the spring's source rock); `nightLine` = the High Span's lights. **The Quay Bridge's label is "the drawbridge"** (MANIFEST `structures.quayBridge.label`, `names.structures`, STYLE's bridge row). | `make_manifest.py` v3.1 L2a block |
| D-WW65 | **The Greenway** is one structure on piles end to end: bed `structure.greenway` (profile `greenway`, kind boardwalk, 6 m, terrainCut false — the terrain is capped 0.65 under it like any open span), the regenerated line simplified ≤ 0.01 and lifted by millimetres so every drawn chord holds ≤ 5 % (the solved profile's 2 m chords reached 5.008 % on bends). Lanes 2.48 plank / 0.12 inlay / 3.22 wheel on a 6.3 × 0.38 fascia, kerbs 0.2 × 0.18, open rails at ±3.05 (bars 0.7 / 0.36; steel pickets on the bridges). Bents every 4 m: a cap and two piles where the deck stands > 1.0 over the ground or water (braces > 3 m, a waler > 6.5 m), short posts below that. **Bridges:** girders 0.42 × **0.5** at ±2.1 (the prototype's 0.95-deep girders under a deck at bed + 4.4 left 3.0 clear, not 3.6), concrete piers every 11 m from s0 + 2 where both feet stand > 4.5 m off every bed's edge, plus a pier searched from the middle of any span > 24 m. | `land/structures/greenway.ts`; MANIFEST `profiles.greenway`, `structures.greenway` |
| D-WW66 | **Places, as built:** A the Reach Gate terrace (12 × 14 at the deck; its east piles at fwd −11, out of the west channel's ribbon) and the Gate Bridge (3.2 m, a 0.25 deck rising 7 % off the terrace to a 6.42 crest over the channel mouth, then an even ≈ 5.5 % fall to the quay, so the register's rowing headroom (≥ 4, proved against deck − 0.6) holds, piles outside the channel's ribbon, landing on the Landing quay's paved edge at 4.7 — the prototype stopped 4.8 m short on the islet); B the Reed Maze trail (ramp, two low boardwalks 0.45 over the ground with kerbs, no rail; the maze rings are ground; the Dune Overlook on six piles; the dipping platform at its pool, a structure without a bed: a bed's 0.65 ground clearance would dig its pool past 0.3); C the Twin Crossing bays (gaps exactly s 240–254: the prototype's 239–255 left 1 m of open edge at each bay end); the Marsh Hide; E the Arch Pier; F the Paddle Dock (floating 0.55 over the sea: the prototype's 0.42 is under the register's 0.5 rule for a bed over water; its gangway runs diagonally from the rail's gap, s 788, to 6 m along the dock — ≈ 9 m at ≤ 12 %, the prototype's straight 4 m drop was 23 %); the Dune Overlook's rail opens where its ramp's line meets the deck (the prototype's fixed corner gap missed the ramp); G the Sunset Balcony (a half-disc on the deck's grade); **H Bluff End turned 90° west** to the bluff edge, centre [861.24, 706.86], on a stone drum to the ground — the prototype's centre 7.5 m straight beyond the end stands on ground rising to 20.3 under a deck end at 18.53; the circle meets the deck's end line only west of its centreline, so a stone apron 1.6 deep carries the deck past its end to the circle (an end rail across the walk's line blocked the path graph). | `greenway.ts buildPlaces` |
| D-WW67 | **Scraped marsh pools ≤ 0.3 m:** the prototype's generator (mulberry32 4242, anchors then fill to 34) on the real line and the bake's own pre-pool ground, levels clamp(median + 0.05, min + 0.08, min + 0.32), capped 0.55 under the deck where it crosses a pool; a new `scrape` water body: inside, level − (0.03 → 0.3 three metres in); outside, raised only (a soft lip to level + 0.02 under the lattice's straddling triangles) — never a river guard band or bank. Never on a bed (≥ 5.5 off every route's centreline except the Greenway's own over-water places) or a pad; the osprey pole's footing [1292,1268] r 9 is reserved (no bed, pad or pool). The pools are sampled on copies of the beds and pads (the terrain's prepared-bed cache is keyed on the live array, which the bake keeps extending: sampling it froze a stale cache into the final terrain, up to 2.4 m off across the island). The Journey board does not draw them (dressing at its scale; `journey/land/extract.ts`). | `land/water/marsh.ts`; `WaterCut.scrape`; `terrain/index.ts applyWaters` |
| D-WW68 | **Modes, joins and the map:** the `greenway` bed class is legal for the board and the bicycle (feet walk every boardwalk; no cars); thresholds at both ends (pick up / park; the far one 30 m before Bluff End's terrace on the deck: the terrace is on foot); the side places join the deck through rail and kerb gaps (register junctions); the Gate Bridge tees onto the Landing quay; the Greenway is a walk line on the Journey map; the story route `greenway` reads MANIFEST `structures.greenway`. | `contact.ts bedClass`; board/bicycle profiles; MANIFEST thresholds; `world/build.ts` lines; `story.ts` |
| D-WW69 | **Lite drops and findings.** Lite drops (never substitutes): the inlay, the kerbs, the fascia, the rails' bars, bottom rails and pickets, five posts of six, braces and three bents of four are drawn into `<id>.fine` twins with an authored empty lite index (`world/prismLod.ts` never re-simplifies an authored lite; `world/districts.ts` counts a solid's lite triangles from its lite index); open rails' long bars chain-merge in lite like handrails. The lite tier keeps the lanes, the top rail with a post every 12 m, the girders, piers and a bent every 16 m. Findings for the integrator: the glider **`sands` landing field** (r 60 at [1095,1362]) now holds the Greenway's deck, the Reed Maze trail and the Dune Overlook (`sky.landing.sands` obstructed) — the field needs moving; the register's pit check now reads a pad's final deck state (a pad on a road at its height digs nothing). | `greenway.ts`; `world/districts.ts`; `beds/build.ts thresholds` |
