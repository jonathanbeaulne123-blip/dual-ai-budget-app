# The Reach and the Greenway — how it looks (PR 3, D-WW120…129)

**SwiftShader, not device evidence.** Headless Chromium (ANGLE/SwiftShader) on the review harness
(`horizon-review.html`, 21 June 2026), 960 × 600 JPEGs, made by `scripts/horizon/capture-reach.mjs --port 5182`. Each
dressing is loaded on a fresh page with `&theme=` in the URL (a live theme swap is not trusted). File names are
`<pose>_<dressing>_<tier>_<hh-mm>.jpg`; `captures.json` lists each pose's eye, target, field of view, draw calls and
triangles.

## What to look at first

- **Page I** (`pageI_*`): the move to the boardwalk's north end. The open timber rail stands at hand height, with reeds and
  cattails coming up to it. The spring's source rock sits in the middle of the frame, the Notch Bluff viewers are behind
  it, and the High Span arches overhead. At night (`22-20`) the boardwalk's island lanterns are lit and the High Span's
  lights run along the top of the frame. The Taylor frame is pastel: a pink deck and rail and paper reeds. The
  Newfoundland frame has galvanised storm lanterns.
- **Notch Bluff** (`notchBluff_*`, the new page): the view from the pad's rail, looking south-east over the marsh to the
  river mouth. At night you can follow the boardwalk's lanterns as a line through the marsh.
- **The porch, Spring Bay** (`porch-springBay_*`): the bay's two viewers (free lever, no coin), the panel, and the reeds
  round the heron's pool.
- **The Greenway** (`greenway-deck_*`): the 6 m deck has a plank foot lane and a smooth wheel lane, with open rails and
  island lanterns every 12 m. Beside it are the scraped pools, a snag, swallow and duck boxes, drifts of iris and cardinal
  flower, and willow and tamarack groves.
- **The Reed Maze** (`greenway-reedMaze_*`): mown rings between cattail walls, the sundial at the heart, and the Dune
  Overlook with its viewers. Long Sands' palms are in the background on this branch's land.
- **Bluff End** (`greenway-bluffEnd_*`): the pavilion on its round terrace, with six benches. The viewers face the Lamp
  across the Bight. The Taylor pavilion has a bunting fringe.
- **The Channel Hide** (`channelHide-dawn_*`): the blind on its piles off the boardwalk at dawn. The slot view
  (`binoc-channelHide-lodge_*`) finds the muskrat lodge in the west channel among lilies.
- **Binocular views** (`binoc-*`): the osprey pole from Notch Bluff and from the High Span Overlook, the heron from Spring
  Bay, the High Span from Sunset Rail, and the Lamp from Harbour Bell Landing.
- **Aerials** (`aerial-*`): the painted marsh margin. A sedge floor with a mud rim follows every channel and pool, so the
  wet ground no longer reads as lawn from the air.

## Honest notes (what still looks unfinished)

- **Distance.** From far away the reedbeds thin to what the planting layer streams in, so the marsh between the channels
  still reads as grass. The new sedge and mud paint covers only the wet margin, 9 m from the water, because the decal
  drapes at 2.5 eu edges and the Reach's lite budget allows only that much. In SwiftShader the paint shows from above and
  from the lookouts but hardly at eye height near the spring.
- **The Greenway's marsh by the deck is sparse.** Reeds only stand at hand height in patches. The `landing` district must
  leave room for Long Sands, so I did not add more.
- **Not in this branch.** The campanile (Little Harbour's branch) is missing, so Spring Bay's view of it is proved by
  `horizonStorySightChain`, not by a picture. The osprey bird, heron and ducks are life records; PR 5 animates them. The
  Bight district is over its triangle cap because of the land, not the dressing (see the handoff).
- **Lite** drops reed density and props without colliders (lite drops, never substitutes). Lite frames are expected to
  look thinner.
- **Harbour Bell Landing at dusk** is dark in the foreground because of the drawbridge deck. Its binocular frame of the
  Lamp is the useful one.
