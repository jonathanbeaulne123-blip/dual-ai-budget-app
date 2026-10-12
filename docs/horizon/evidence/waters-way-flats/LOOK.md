# The Flats & the Bight (module `flats`): what the captures show

SwiftShader, not device evidence. Headless Chromium on the review harness (`scripts/horizon/capture-flats.mjs`), 21 June
2026, America/Toronto, 1280 × 800. Golden hour is 19:50, night is 22:40. Files are named
`<pose>_<hh-mm>_<dressing>_<tier>.jpg`. `captures.json` holds every eye, target, field of view and time, plus the
whole-scene draw calls and triangles. Each shot waits until the stream has nothing pending and neither the corridor nor
the dressing layer is still building. Without that wait, the first shot after a move showed bare land.

## The story beats

- **The grain elevator** (`elevator`, `H`, `station`, `hoodoos`, `final`, `aerial`). It is the place's landmark: a red
  clapboard bin on the airport tower's footprint, with a plain painted band (no lettering), the stepped head-house, a
  diagonal grain spout and the green-and-white beacon on the ridge. Its cap is at 63.5. It reads from every pose,
  including on final and from 240 m up. At night (`*_22-40`) the band floodlights and the lens show as small emissive
  points. The beacon is a few pixels at page H's distance and there is no sweep, so it is a weak night face.
  Taylor is pink paper with a yellow band; Newfoundland is barn red with white trim.
- **The windsock** (`H`, `wash`) is the island's only one, on its moved footing at [467.5, 508], streaming north. The
  airport no longer draws its own.
- **No lettering anywhere.** Every airport board is a pictogram: the hangar arch and a wrench on the Quonset, a plane over
  the horizon on the station, and the aircraft shapes at the stands.
- **THE hangar** (`quonset`) is the tin Quonset: a corrugated barrel, ribs, an open east mouth and the curtain tied back.
  Against the golden-hour sky it reads dark slate rather than silver.
- **The station** (`station`, `elevator`). It now reads as a timber prairie station all round. The merged glass entry
  walls, east walls and roof-deck rails are drawn as board-and-batten with framed windows and a board parapet. The boxes
  and their collision are unchanged. Before this change the building read as a glass pavilion.
- **The Wash** (`wash`, `hoodoos`, `elevatorTop`). The arch over the Wash Run now reads as ochre stone: the land's own
  arch boxes (legs and lintel) are drawn ochre instead of pale grey. The five hoodoos stand on the Wash's east rim, with
  sage, bluestem and juniper at their feet. Before this change their footings sat on the bank's face and stood up to
  9.6 m bare under the drums, like pedestals.
- **The stargazing deck** (`stargazing`): the timber deck with three benches, the domed hut and its red path lamps,
  dark at night.
- **The geoglyph** (`final`): the chalk bush plane lies flat in the north approach, with no letters.
- **The balloon** (`H`, `elevatorTop`, `aerial`) is at its mooring. Classic has rust gores, Taylor pastel and
  Newfoundland red, yellow and blue.
- **The lookout** (`elevatorTop`): from the head-house toward the Library across the Wash and the Bight. The Library's
  own dressing is on the Scholars branch.

## The porch

`porch`: the hangar's bench, looking down the strip's east side toward the Bight Bridge. The bluestem is cleared for 7 m
around the bench and along the first 45 m of the frame, so the seated eye looks over the grass. The bridge's arch does
not show above the rim at a seated eye: the frame holds the Wash's ochre bank, the Wash Run head and the strip.

## What is still rough (honest)

- **The prairie is thin from the air.** About 4,100 bluestem tufts in fbm drifts read clearly at ground level (`wash`,
  `H`). From 240 m (`aerial`) the plateau reads as bare ochre ground. The Flats district is at 145.5k of its 150k
  triangles, so there is no room for many more.
- **The Bight Shore walls** (`bight`). The plots' retaining walls still stand 11.9–19.4 eu above the land's batter, with
  a saw-tooth seam where the wall meets the battered ground. That is land geometry; the dressing cannot hide it. The
  shore planting (36 per plot) and the eelgrass (64) are small marks on it. The Bight has 114 lite triangles left.
- **The sandbar** is not drawn. The water has no moon-phase level, so it is owed to the water system.
- **Small things:** the hoodoo footings still show a low ochre plinth (about 0.5 m). One clump rock stands right under
  the `station` eye. The airport's five point lights predate this work and are left as they were.
