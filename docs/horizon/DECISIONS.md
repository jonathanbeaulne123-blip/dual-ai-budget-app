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

### PR 2 land, L2b — Little Harbour, Long Sands, the Green (2026-10-05)

Builder L2b on `ww/land-south`, from the approved asks (protos `harbour`, `long-sands`, `green` LAND-ASKS) and RULINGS 1, 9, 10.

| Id | Decision | Where it lands |
|---|---|---|
| D-WW70 | Town Weave (S3) 8 m inland along the quay (3B): the prototype's own transform (`place.py s3_shift`: 8 m along (−0.67, −0.74), full for z 1256–1296, smooth ramps 1236→1256 and 1296→1314) is applied by the land solver to the sampled centreline before grading (`skatePlanShift`, MANIFEST `skate.S3.move_3B`); the controls stay as authored, so nothing moves outside z 1236–1314 (the square's floor, the Market stair, the river-mouth bridge). `quayWest` moves with the line to [1447.64,1271.08]; the "town quay at grade" pin moves the same way | `land/beds/build.ts`, `land/beds/solver.ts` (`planShift`); `make_manifest.py` |
| D-WW71 | Page A retargets from the retired Stillwater dam to Mountain v2's glass dam from the porch pose: eye (1432, ·, 1166) → (1318, 108, 560), 50°; subjects "the glass dam" (first hit within 30 eu of [1316,538] at its face heights 87–142: the region draws it, the bake does not) and "the Shoulder". STYLE §2.1's dam line is (1433,1158)→(1316,538), 14 m half-width, ≤ 6 eu, tested on the bake | `world/views.ts`; MANIFEST `views[A].damLine`; STYLE §2.1 |
| D-WW72 | The Glasshouse stair-and-ramp: one definition (`land/terrain/glasshouseScarp.ts`) for the stair (four flights straight down the batter, pitch 0.608, level landings at 44.5 / 38.9 / 33.3 / 27.6 / 22) and its step-free twin (four legs at ≤ 8 % on the batter's contours, 4 × 8 turning landings, 296 eu, steepest 7.74 %), sharing the head, middle-turn and foot landings. The Glasshouse steps' dead end (16 m over the spur) joins it by `walk glasshouseTerrace` (≤ 8 %) over the new Glasshouse Footbridge (span 22, deck 50 over the spur's 34). The foot landing [1008,946] at 22 is where PR 3's desire lines start | `land/structures/waterwaySouth.ts`, `land/terrain/glasshouseScarp.ts`; MANIFEST `structures.glasshouse*`, `walks.glasshouseTerrace` |
| D-WW73 | The Green's north scarp is ground, not a skirt: west of x 1028 the cut face is cut and filled to one 1 : 2 batter through its midline (meeting the terrace and the Green with no step); east of x 1048 the "terrace" is Stillwater's own raised bank (`applyWaters`), so the batter only fills below it (capped at the bank crest) and the bank decays onto it. Ground ≥ 40° over the scarp: west zone 840 → 282 m², east zone 912 → 732 m² (the east end meets the S1 shelf's cliff) | `land/terrain/glasshouseScarp.ts` (`glasshouseScarp`, in `baseHeight`) |
| D-WW74 | Long Sands' pier is land: deck 12 wide at 3.6 (0.6 thick), open rails 1.05, piles every 12 m (none in the dune trail's corridor), a 4.3 % ramp from the Tideline slab (3.0 at z 1434.6 → 3.6 at 1448.6). As drawn (to z 1630, platform to 1659) it crossed the FERRY line (z 1533 at x 1020): the pier now ends at z 1520 (platform x 1002–1034 × z 1490–1520, 4 m wider west so the wheel's A-frame feet stand on it) and the wheel moves inland along it, hub [1010,19.6,1648] → [1010,19.6,1509] (`world/story.ts` `wheel`, `wheelTop`). Contracts: dune-trail headroom 2.62 ≥ 2.4; ferry hull 8.91 clear (≥ 6); glider: the wheel stands 151.5 off every launch → sands line and 96.1 outside the field | `land/structures/waterwaySouth.ts`; MANIFEST `structures.longSandsPier` |
| D-WW75 | The skate bowl is sunk beside the Tideline park, never on its slab: centre [1000,1456], rim 3.0 (the park's level; coping r 6.5–7.0), floor 1.5 (flat to r 2.5), a parabolic transition (lip slope 0.75); its apron square is the terrain's hole (mouth mask kind `bowl`) and a pad banks the beach up to it. PR 5 rides it | `land/structures/waterwaySouth.ts`; MANIFEST `structures.tidelineBowl` |
| D-WW76 | The promenade (7.5, concrete, `walk promenade`, x 795–1245 on the prototype's promZ, level 3.0 across the park; east of x 1160, where the prototype's 11.5 m-from-the-Drive rule bound, it stands 16.5 m off the Drive so the Drive's Long Sands Shore scenic stop keeps its verge) and the Strand (3.2, paving, `walk strand`, its seaward footway at +5.6: feet, bicycles, boards) as beds; joined to the dune walk west (`walk strandDune`) and east of the pier (`walk tidelineBeach`); the Year Walk crosses both at grade at x ≈ 948 (register rows) | MANIFEST `walks.*` |
| D-WW77 | Green Road's lanterns inside the protected circle (VG.lamp.9–14; lamp 9 the High Span's bridge lantern, standing on its rail line below the 1.05 rail, so the bridge's guard is unchanged) are the island lantern's 0.8 eu bollards (the corridor planner's low-zone rule). Baskets #4/#6/#7 move 6.6 / 8.2 / 7.4 m along the ring (≥ 6.6 m off every bed); #8 leaves the terrace for the nearest ring spot within 4 m of the Green's level ([939.1,905.2], 189 m); the Drop Zone and `sky.landings.green` to [1037.2,1115.8] | `land/corridor/plan/lamps.ts`; MANIFEST `pastimeData.nineBaskets`, `sky` |
| D-WW78 | One open-rail rule for every ray: `world/raycast.ts` `isOpenRail` (a timber post-and-rail guard's collider, or any solid of kind `openRail`, e.g. the pier's rails) — the view proofs and the story sight chain both see through it | `world/raycast.ts` |
| D-WW79 | Small additive land interfaces: `MouthMask.kind` gains `bowl`; `walks.<id>.material` and `.grade_max_pct`; `gradeRoute(..., {planShift})`; `structures/build.ts` exports `along`, `planLength`, `laneGuard`, `postedRail` | `land/interfaces.ts`, `land/beds/*`, `land/structures/build.ts` |

