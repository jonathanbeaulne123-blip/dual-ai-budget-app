# The Water's Way — the Horizon's story

**Status.** Approved by Jonathan on 5 October 2026 ("recommended on all"; decision D-303, [`docs/DECISIONS.md`](../DECISIONS.md)). This book is the design record; the one definition every consumer reads is [`src/harbour/horizon/world/story.ts`](../../src/harbour/horizon/world/story.ts) (places, landmarks, eyes, sight chain, evening relay, noon bells, routes). Its proofs are [`test/horizonStorySightChain.test.ts`](../../test/horizonStorySightChain.test.ts). Names are proposals (CONTRACT §2.13). Source material: the project note `claude/the-waters-way-2026-10-05.md`, the artifact "The Water's Way", and the seven prototype chats (one per neighbourhood).

## 0. The idea in one paragraph

The seven neighbourhood prototypes become one story by following the one thing everyone on the island can see and hear: the water. It starts as snow on Glacier Peak at dawn, falls down the Veil, rests by the Green, slows in the Reach, meets the sea at Little Harbour, plays along Long Sands, rises into the sky over the Flats at dusk, and comes back as fog in the Scholars' woods before the next dawn. Each place is one stage of the water and one hour of the day, and from each place's lookout you can see the next place's landmark. The order runs downhill, then clockwise round the coast, which is also the ferry's direction. Walk it, ride it, row it, take the ferry or fly it in that order and the island reads as one book.

## 1. Never "Chapter" in the app

The app never calls these places "Chapters", "Chapter 1" or anything numbered like a book. In Hearth a **Chapter is a month**: the month you close at the Sitdown, and the monthly Campfire (STYLE §2.5's "when the Chapter is open"). Two meanings of one word on the same island would blur the books' most important ritual. The story is told by the world (landmarks, light, bells, routes and the order things happen), never by on-screen text. "Book", "place" and the place names are fine in design documents; the registry's test fails if any story record carries the word.

## 2. The book

| # | Place | Neighbourhood · districts | Story hour | Water stage | Landmark | Lookout (sees the next landmark) |
|---|---|---|---|---|---|---|
| 1 | **The Highlands** (Mountain V3 / V3.1) | `crown` · crown | dawn | snow, springs, tarns, six falls | Westwatch Chapel's bell cote (+ the Veil) | Fallswatch on the west buttress → the Old Oak |
| 2 | **The Green** | `lakeside` · green, lakeside | morning → noon | the Veil's pool, Stillwater, a still meadow | the Old Oak, 36 m | under the oak → the osprey pole |
| 3 | **The Reach** + the Greenway | `landing` · reach, notch | late morning | marsh, channels, the river mouth | the osprey pole (six lookouts share it) | Spring Bay → the campanile |
| 4 | **Little Harbour** ("cobblestone Italy") | `harbour` · harbour | afternoon → golden hour | the river meets the sea | the campanile | the belfry → the Ferris wheel |
| 5 | **Long Sands** (California boardwalk) | `landing` · landing | late afternoon → sunset | surf, the pier, the strand | the Ferris wheel | the top of the wheel → the grain elevator |
| 6 | **The Flats & the Bight** (airport hybrid) | `flats` · flats, bight | golden hour → night | the lagoon, the dry Wash, the sky | the grain elevator + beacon | the elevator gallery → the Library |
| 7 | **Scholars' Edge** (layout B) | `scholars` · scholars | night → before dawn | fog, dew, rain in the canopy, the cove | the Library (verdigris roof) | the Bight lookout → Westwatch, closing the loop |
| · | **The Hollow** (interlude) | `hollow` · hollow | — | Rillcut Falls, the Hollow Tarn, the second stream | — | — |

The hours come from each place's STYLE/LIGHT best hour, nudged so the book runs from dawn to night once round.

**What each place is, briefly.**
1. *The Highlands.* Glacier Peak feeds the springs, the Twin Tarns and six falls. Sheep on the benches, a crofting hamlet on a real shelf, Westwatch Chapel ringing the day in; the Rim Walk, the footbridges, the drag lift, the Fallswatch deck in the Veil's spray. V3.1: one ridge system with benches as shelves on spurs, a steeper horn, the Veil amphitheatre cleared. The glacier itself is hidden from the south and west by Mountain v2's crest; the story keeps that: you see the source's water everywhere, but you find the source by climbing.
2. *The Green.* The Old Oak on the south rim with its ring bench, rope swing and picnic tables; the Oak Clock's twelve month stones, the turf labyrinth, the apiary, kites, the Drop Zone, the Lantern Ring drawing the protected circle at night; the Meadow Pavilion and the windpump outside the circle.
3. *The Reach.* A conservation marsh: six lookouts (Notch Bluff, High Span Overlook, Spring Bay, Channel Hide, Sunset Rail, Harbour Bell Landing) round the osprey pole, open timber rails, the heron, free-lever binoculars. The Greenway carries the marsh west on a 6 m deck to the bluff above the Bight: the Reed Maze, the Marsh Hide, reed rafts, the Sunset Balcony, Bluff End.
4. *Little Harbour.* A Ligurian harbour town: about a hundred row houses solved onto every real frontage, the palazzo bank, the pink villa (Our home), the brick piazza, cobbled lanes, laundry lines, olive terraces and the campanile; bocce, the harbour bell, the Giro del Porto, the passeggiata along Lantern Row at dusk.
5. *Long Sands.* A 450 m promenade with the Strand bike path, fan palms, pastel storefronts with striped awnings, lifeguard towers, volleyball, the skate bowl, and a pier with a seafood shack and the 26 m Ferris wheel; festoons, fire rings and the Campfire at night.
6. *The Flats & the Bight.* The prairie airfield: a red grain elevator with a green-and-white beacon on the tower footprint, a tin Quonset as the one hangar, a timber station, a chalk bush-plane geoglyph, a rock arch and a few hoodoos at the Wash, the balloon, and a stargazing deck under the darkest sky. The water leaves as weather: planes and the balloon go up; the Wash runs only after rain.
7. *Scholars' Edge.* The densest woods; the Library in board-and-batten and verdigris; the reading courtyard on the sunlit south-west gable; the Bight lookout on a 60 m spur, framed by a pine and a birch. Fog thickens under the canopy: the water comes back to land before it climbs to the Highlands again.

## 3. Landmarks and eyes (canonical, bake 9d13db2)

Ruled by the integrator on 5 October 2026 from the prototypes' real positions; `world/story.ts` holds them. Modules (PR 3/4) emit `Landmark`/`Lookout` records with these ids; `validateStoryAgainstDressing(def)` checks them within 3 m in plan and 1.5 m in height.

| id | Base [x, ground, z] | Sighted top | Notes |
|---|---|---|---|
| `westwatch` | [1036, 86, 318] | [1038, 97, 313.2] | bell cote on the north gable, cote top 96–98, verdigris |
| `fallswatch` | [1086, 95.3, 694.3] | deck lamp ≈ 97.6 | a lookout that lights second in the relay; on the V3.1 west buttress (its 10 × 5 deck on the buttress's cover ridge, PR 2 L1) |
| `veilLip` | [1111, 92, 699] | aimed at the lip itself | what Fallswatch must see |
| `oak` | [1125, 16.1, 1165] | y 52 | the Old Oak |
| `osprey` | [1292, 4.1, 1268] | y 15.6 (nest) | pole + nest, planting clear within 9 m |
| `campanile` | [1423, 10.06, 1187] | apex 42.3 | belfry cornice 38, bell 34.3; the shaft stands on a plinth to the lowest ground |
| `wheel` | pier deck under the hub [1010, 3.6, 1648] | rim top 32.6 | hub y 19.6, r 13, faces NE |
| `elevator` | [395, 35.5, 706] | 63.5 | on the airport tower footprint; side clearance vs the strip owed |
| `library` | [740, 48, 400] | ridge 64 | the host's greybox roof is 62 today |
| `lamp` | [540, 0, 1195] | gallery 25 | the baked lighthouse gallery (MANIFEST `offshore.lamp.xy` [540,1230] is the islet's centre) |

Eyes (`STORY_EYES`): Fallswatch [1086,694.3] deck + 1.6 (96.9 on the bake); under the oak ground + 1.6; Spring Bay [1246.4,1199.5] eye 6.6 (deck 5.0); the five other Reach lookouts at their binocular eyes; the belfry [1423,1187] 34.4; the top of the wheel 31; the elevator gallery 62; the Bight lookout [744,511] 53.6 (deck raised ~2 m to 52.0).

## 4. Through-lines

All of these are in the world, not in the UI.

### 4.1 The water, unbroken
Two surface water paths reach the sea: springs → the seep → Veil Falls → Stillwater → the sill → the Notch → the Reach → the river mouth; and (V3.1, PR 2 L1) springs → the Twin Tarns → the Rillcut → Rillcut Falls → the Hollow Tarn → the Hollow Beck → Orchard Brook → the Bight. Each stage has its own sound bed, so you can hear where you are in the story with your eyes shut. **The second stream** (approved): a short new reach from the Hollow Tarn into Orchard Brook, so the Rillcut's water no longer soaks away in the tarn but runs through the Hollow to the Bight, and the Flats get the Highlands' water too (PR 2 land).

### 4.2 The sight chain
Each place's lookout frames the next place's landmark. One Lookout kit (viewer, bench, panel, open timber rail) at about sixteen spots; the binoculars have a free lever where a coin box would be (no money in the world, CONTRACT §2.1). The tap is a zoom cut (twin-circle mask, fov 3–9). **Every binocular finds the Lamp**: it is the island's compass, the way every Reach lookout finds the osprey.

**The proof.** `world/storySight.ts` measures each link on the same first-hit ray caster as the Sketchbook view proof (`world/raycast.ts`: the baked heightfield with mouth masks, every water surface, every baked solid). Clearance is the largest vertical drop for which the eye→aim segment, translated down, still reaches the aim with nothing hit; the aim is the landmark's top less 2 m (so the top shows, not only its tip). The segment starts 3.5 m out for an eye on a structure (its own open rail, belfry frame or cabin) and 1 m out for an eye on the ground; the target's own solids and the eye's own structure are not occluders. The contract is **≥ 0.5 m**. Today the landmark tops are virtual points (the dressing buildings arrive in PR 3/4); once they are baked solids the same test includes them.

| Link | Clearance (m) | Over (m) | First limit | Depends on |
|---|---|---|---|---|
| Fallswatch → the Old Oak | **6.08** | 472 | the buttress's south face beside the eye | built (PR 2 L1: the V3.1 west buttress) |
| (Fallswatch → the Veil lip) | **1.95** | 25 | the buttress's edge at [1087,95,694] | built (PR 2 L1) |
| under the oak → the osprey pole | **1.61** | 196 | ground at the trunk | — |
| Spring Bay → the campanile | **−0.06** today; **2.89** with the Reach Footbridge's rails open | 177 | the Reach Footbridge's 1.15 stone parapet (top 10.65) | open rails on the Reach Footbridge (PR 2), seen through by the ray caster |
| the belfry → the Ferris wheel | **22.93** | 619 | Horizon Drive's kerb (reach 7) | the campanile, the pier |
| the top of the wheel → the grain elevator | **18.62** | 1,125 | the Flats rim at [475,39,829] | the pier and wheel, the elevator |
| the elevator gallery → the Library | **14.00** | 461 | the Library host's slab | the elevator |
| the Bight lookout → Westwatch | **3.16** | 354 | ground at the deck edge | the raised Bight lookout deck (PR 2, PR 4) |

**The one link that fails today.** Spring Bay → the campanile is cut by 0.06 m by the Reach Footbridge's solid 1.15 m stone parapet (the same parapet family the Reach prototype replaced with open rails on the boardwalk). The registry records `reachFootbridge.rails` as an **owed occluder**: the test passes only if it is the sole limit and the line clears by ≥ 0.5 m with it opened (2.89 m); once the bake no longer limits the line by it, the test fails until the entry is removed, so the exception cleans itself up. The fix is PR 2's: open timber rails on the footbridge too, and the ray caster must see through open rails (today it does so only for post-and-rail corridor guards).

**The Lamp from the story eyes** (≥ 0.5 m to the gallery less 2 m): seen from **8 of 12** — under the oak 1.62, Notch Bluff 4.75, Sunset Rail 2.52, Harbour Bell Landing 1.28, the belfry 13.51, the top of the wheel 19.38, the elevator gallery 5.29, the Bight lookout 8.10. Not from Fallswatch (0.00), Spring Bay (−5.57) or the High Span Overlook (−3.09). The contract is ≥ 6. Every other binocular target each eye lists (the osprey from all five Reach lookouts that face it, the oak, the Veil lip) is proved the same way; the tightest is Harbour Bell Landing → the osprey, 0.61 m past the Quay Bridge's rail.

The oak is the island's second constant: Fallswatch (6.08), the belfry (22.35), the top of the wheel (31.17), the elevator gallery (23.03) and the Bight lookout (5.20) all see it, and so do the Reach lookouts.

### 4.3 One day, once round
Each place gets a Sketchbook page at its story hour, so the book's pages run dawn to night. The existing twelve stay. Changes and new pages (PR 5, with their view proofs): page **I** moves to the boardwalk's north end (night line: the High Span's lights; the Quay Bridge is "the drawbridge"); page **A** retargets the square's view to the v2 dam; the **belfry** page ("From the belfry", north) is the dam view; new pages "Over the roofs" (belfry south), "From the water" (the harbour mouth), Notch Bluff, the wheel at sunset, the Flats tower and the Bight lookout (the Scholars porch pose); page **H** takes the tested pose eye [452,58,890] → [428,30,480]; page **D** gains a night pose; page **L** gets a lantern on the Boathouse gable.

### 4.4 The evening relay
At civil dusk the landmarks light in story order, each visible from the one before: the chapel lantern, the Fallswatch lamp, the Lantern Ring, the osprey-pole lamp, the belfry, the wheel, the elevator beacon, then the Library windows. **5.5 s apart with a 1.5 s fade: 40 s from civil dusk to the Library** (`EVENING_RELAY`, `relayStartSeconds`). Built on the dusk sequencer (LIGHT §7's "one by one as you watch") with **emissive cards, not point lights**: the 6 full / 2 lite light pool is untouched; lite keeps every relay card; reduced motion switches each card on without its fade.

### 4.5 The bells
At solar noon Westwatch rings, the summit bell at `L02` answers a beat later, then the harbour campanile (`NOON_BELLS`: 2.4 s beats, each quieter). This extends LIGHT §7's harbour bell and the planned summit-and-harbour answer to three bells across the story. Once a day, respects mute; sunrise and sunset ring nothing.

### 4.6 Every way round

| Route | Mode | MANIFEST | Places |
|---|---|---|---|
| the Year Walk | foot | `journey.yearWalk` | all, the Hollow included |
| Summit to Sea | board | `skate.S1` | 1 → 2 → 3 |
| River Run | canoe | `water_routes.RIVER_RUN` | 2 → 3 → 4 |
| the Greenway | foot + wheel | new (`greenway` profile, PR 2) | 3 → 6 |
| the ferry | ferry | `water_routes.FERRY` (clockwise) | 4 → 5 → 6 → 7, exactly story order |
| Dam Run | glider | `sky.courses.damRun` | 1 → 3 |
| the Lamp Hop | glider | `sky.courses.lampHop` | across the Bight (5 → 6) |

## 5. The Hollow interlude

The orchard bowl sits in the middle of the loop, between places 1, 2 and 7, and had no prototype. Leaving it greybox would put a hole in the middle of the book, so it is dressed from its own STYLE sheet (§2.2: orchard rows, the kiln, the covered bridge) with the same kits in PR 3, and given one story job: **the second stream** (§4.1).

## 6. Edits so the places fit each other

| Seam | The problem | The fit |
|---|---|---|
| Little Harbour ↔ Long Sands | Italian stucco and California pastel 300 m apart, the Reach between | one **warm coast** family: stucco, terracotta tile, painted trim. The Boathouse is the hinge: white walls, terracotta roof (on its baked footprint and height). Olives and cypress on the harbour side; fan palms only west of the Quay Bridge; **no palm ever stands in the Reach** |
| the Reach ↔ Long Sands | reeds meet a party beach at Tideline | the Reach Gate in plain timber and brass; the promenade starts with its sentinel palms; Tideline park is the handshake; the marsh boardwalk's light timber rail carries on as the Strand's rail |
| the Green ↔ the Reach | two lantern styles | **one island lantern** (brass, 2.6 eu post) for the Lantern Ring, the Reach posts and the Greenway |
| the Greenway ↔ the Bight | marsh can't sit on the bluff; the Bight Shore plots' 15–22 m walls fill the deck's views | pine and spruce on the bluff end; the plot walls battered and planted with shore planting (fixes the Flats finding too) |
| the Flats ↔ Scholars' Edge | prairie to dense woods | juniper and red-cedar clumps thicken into black spruce and balsam along V01 |
| Scholars' Edge ↔ the Highlands | Library timber and copper against crofter stone | Westwatch's bell cote takes the Library's verdigris; dry-stone walls begin at the north pass |
| the Highlands ↔ the Green | the Glasshouse steps stop 28 m above the Green; Fallswatch couldn't see the fall | a stair-and-ramp down the scarp; Fallswatch on the west buttress, looking along the Veil and down to the oak |
| the protected Green ↔ Green Road | six road lanterns inside the 160 m circle | 0.8 eu bollards; STYLE rule 12 names the road |

## 7. The build: five PRs

Build what is shared once, so seven neighbourhoods don't each invent houses, reeds and lanterns; then each neighbourhood is mostly data in its own folder, built in parallel.

1. **Common ground.** The dressing engine (one streamed, instanced, theme/season/night-aware layer per district; lite drops detail); the building grammar (one footprint record → collidable baked solids, runtime art in three dressings, a Journey-map silhouette); the plant and prop kits; the story registry with the sight-chain proofs; this book, the STYLE amendments and the decision entries. The contract is `src/harbour/horizon/neighbourhoods/types.ts`.
2. **The land** (in parallel with PR 1), one re-bake: the V3.1 landform; the Greenway bed and its profile; the Reach open rails (boardwalk, bays and, for the sight chain, the Reach Footbridge), the Notch Bluff and Sunset Rail pads, the Channel Hide, the pools; the Scholars spur and raised deck; the Glasshouse stair; Town Weave 3B; the Long Sands pier; the windsock move; the Bight Shore walls; the second stream. Seat audits before and after; byte-exact bake check.
3. **Downstream:** the Highlands, the Green, the Reach with the Greenway, Little Harbour, the Hollow — one subagent and one folder each, lights, life, planting, fixtures and three dressings.
4. **The long way round:** Long Sands, the Flats and the Bight, Scholars' Edge — built alongside PR 3, split only so each PR stays reviewable.
5. **Through-lines and play:** the relay, the bells, the binocular zoom; the Sketchbook pages; the Journey map landmarks; the Lantern Hunt spots; bocce, the Giro del Porto, volleyball, kites, the swing, the Reed Maze, stargazing, the wheel ride, the drag lift. Play earns nothing: no scores, prices or streaks.

**Every PR's bar** (horizon-create): typecheck, a byte-exact bake check, the Horizon suites one file at a time, per-district budgets (≤ 150k / 60k triangles, ≤ 400 / 180 draw calls), a view proof for each sight link, captures in three dressings × day and night × full and lite (headless SwiftShader, not device evidence), a blind technical review and a player's-eye review, a handoff. No money paths, schema, sync or presence change; nothing near the `L01` binding.

## 8. Limits and what is owed

- The landmark tops are planned points until PR 3/4 bake the buildings; the test will then include them as occluders and the registry's tolerance check guards drift.
- Fallswatch's links and the Bight lookout's depend on PR 2's land (the buttress top; the raised deck). Spring Bay → the campanile depends on PR 2 opening the Reach Footbridge's rails and the ray caster seeing through open rails.
- The wheel's spot depends on the pier as built; the elevator's side clearance against the strip is owed (PR 4); the Westwatch cote must reach ≥ 96 (PR 3).
- Measured on bake 9d13db2; nothing here is device evidence.
