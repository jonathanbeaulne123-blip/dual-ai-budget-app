# Long Sands — what the captures show (The Water's Way PR 4, `landing` · Long Sands)

**SwiftShader, not device evidence.** Headless Chromium with SwiftShader on the runtime review page
(`horizon-review.html?world=horizon&tier=<full|lite>&theme=<…>&date=2026-06-21`), 1280 × 800 JPEG, by
`scripts/horizon/capture-sands.mjs` (poses and notes are in that script; `captures.json` lists every shot with its draw calls
and triangles on screen). Day shots are 16:30 (page D), 19:30–20:30 (late afternoon into sunset, the place's story hour) or
06:00 (page L's "also: dawn"); night shots are 22:30. Names: `<theme>-<tier>-<pose>-<day|night>.jpg`.

## The place in one look

- `classic-full-aerial-day` — the whole boardwalk from the south-west: the storefront row on the deep west verge, the
  palm rows along the promenade, the beach with towers, courts and umbrellas, the pier with the Ferris wheel on its platform.
- `classic-full-promenade-day` / `-night` — the promenade west from the pier plaza: two staggered rows of 17–24 m fan palms,
  the Strand bike path, a coral two-storey storefront (striped awning, blank sign band, no lettering), festoons strung across
  the promenade between palms; at night the shop windows and the festoons are lit.
- `classic-full-wheel-day` / `-night` — the 26 m wheel on the shortened pier (hub [1010, 19.6, 1509], the pier ends at z 1520
  for the ferry line), facing north-east; at night its 32 rim bulbs and the pier's island lanterns.
- `classic-full-pier-day` / `-night` — from the pier back to the land: a Canary palm at the pier's foot, the shack, a lifeguard
  tower, the wind-bent pines behind the dunes east of the pier, the zip landing tower.
- `classic-full-beach-day` — a lifeguard tower on stilts (ramp to the land), boats drawn up, the beach running west.

## Sketchbook pages and the porch

- `*-D-page-day` (16:30) / `-night` — page D's baked pose: the wheel, the umbrellas, page D's deferred bench, a beach fire
  ring (at night an ember glow in the ring and a warm pool on the sand), the zip landing. The landing tower still fills the
  middle of the frame (the land's pose, unchanged).
- `*-D-night2-night` — the proposed night pose for page D (47 m east of D): the wheel lit on the horizon, the zip landing, the
  palms, the festoons and the Campfire.
- `classic-full-campfire-night` — the Campfire's ring of log seats on its slab, its fire glow showing over the seat backs.
- `*-boathouse-day` / `-night` — the Boathouse re-dress on its baked footprint: white walls, terracotta gable, blue boat doors
  on the east gable with the gable lantern above them (page L's light), lit windows at night. Taylor keeps it white paper;
  Newfoundland paints it red clapboard under a dark roof (its working-waterfront sheet).
- `*-L-page-day` / `-night` and `classic-full-L-zoom-night` — **the Boathouse is not visible from page L.** From the page's own
  eye (the town quay, [1484, 1295]) the Quay Bridge deck and the bank at about [1410, 1302] cover it entirely; the zoom shows
  only a speck of the gable lantern under the bridge deck. Fixing it is a land/view call (move or raise page L's eye), not
  something the dressing can do.
- `classic-full-porch-day` / `-night` — the porch pose from the Boathouse dock: the Quay Bridge's pier fills the frame (the
  land's composition).

## The story

- `classic-full-belfry-wheel-day` — from the belfry's eye: the wheel stands on the horizon as a ring. Beyond residency the
  wheel is drawn by its far silhouette, now its rim on an A-frame (it was a 28 m grey pyramid).
- `classic-full-wheeltop-elevator-day`, `classic-full-wheeltop-lamp-day` / `-night` — from the top cabin's seat (just off the
  wheel's plane): the promenade, the storefronts, the palms and the beach below. The Flats' grain elevator is the Flats
  builder's and is not in this branch, so it is not in the frame yet; the sight line itself is proved by the test
  (wheelTop → elevator 17.84 m clear, wheelTop → lamp 16.67 m).
- `classic-full-wreck-day` — the Wreck: a grounded plank hull on the reef's flat top, broadside to the ferry's side.

## Three dressings and lite

- Taylor (`taylor-*`): pastel paper storefronts with scalloped awnings, paper palms, the same promenade.
- Newfoundland (`newfoundland-*`): clapboard stores in jellybean colours, every palm drawn as a wind-bent pine (the Canary
  palms too), the red clapboard Boathouse.
- Lite (`*-lite-*`): the same frames with lite's drops (fewer umbrellas, towels and tufts; palms thinned except those a
  festoon hangs from; the aerial loses the far planting). Nothing is substituted.

## Rough, honestly

- Page L cannot see the Boathouse (above). Page D is still dominated by the zip landing tower (the land's pose).
- No people, walkers, cyclists or surfers: the kit has no person kind; the beach reads busy only through its things.
- The prototype's sit-on seawall (white, 0.55 m, along the Strand's seaward edge) is not built: the contract has no wall kind
  for it (a `PropKind` addition; owed).
- The wheel's rim bulbs are flat cards: from the top cabin they read as small cream rectangles.
- Fan palm crowns are the kit's low-poly frond clusters; fine at a distance, blocky in the closest shots.
