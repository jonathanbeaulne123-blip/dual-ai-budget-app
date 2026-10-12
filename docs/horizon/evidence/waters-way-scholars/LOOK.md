# Scholars' Edge (layout B): how it looks

SwiftShader in headless Chromium on the runtime review page (`horizon-review.html`), not device evidence. Shot by
`scripts/horizon/capture-scholars.mjs` on 21 June 2026 (America/Toronto). Golden hour is 19:47 and night is 02:00.
`captures.json` lists every frame with its pose, clock, draw calls and the district's dressing stats. Its `sha` is the
parent commit, because the frames were shot from the working tree that became the Scholars' Edge finishing commit.
The glade frames are a second shoot with a corrected pose.

The file names follow `pose_hour_theme_tier.jpg`. Every theme has its golden-hour porch, courtyard, Library and glade
frames, and its night porch, courtyard and spur frames. Each theme also has a lite porch and a lite courtyard.

## What each pose shows

- **porch.** The Bight lookout deck at eye height, the porch pose. It looks across the Bight to the Bight Bridge and
  the Flats cliff. The grain-elevator tower stands on the skyline at the right. A seated viewer and a framing spruce sit
  at the right edge, and the deck's open rail is in front. At night the Flats' lights are a thin line. On lite the
  bridge is beyond the streaming radius.
- **binoWestwatch, binoLamp.** The binoculars' 9° field from the story eye (deck + 1.6).
  - **binoWestwatch.** The cone toward Westwatch is cut through the canopy: the crowns at the near edges frame an open
    gap. The bell cote itself is the Highlands builder's, so on this branch only its ground shows. The sightline is
    proved by test on the bake.
  - **binoLamp.** The Lamp's baked gallery, in the haze.
- **westwatch.** The same line at 50°, framed by the woods.
- **spur.** The 60 m gravel spur up to the deck. The knee-height bollards stand alternately along it, and the deck's
  rail is at the end.
  - At night each bollard is a lit cap with its warm pool, in all three themes.
- **courtyard.** Courtyard B on the south-west gable, looking into the sun window toward the golden-hour sun.
  - The flags, the reading tables and chairs, the benches and the low wall with its rail sit on the battered edge. The
    book cart sits by the gable.
  - The sun-window glade opens to the WNW sky. Golden-hour sun reaches 100 % of the courtyard's samples.
  - At night the gable window glows and spills onto the flags.
- **library.** The reading-room gable and the verdigris roofs from the courtyard's far corner. At night two gable
  windows glow and their pools spill under the wall.
  - Taylor draws the linen walls. Newfoundland draws the grey stone and shingle with the verdigris kept.
- **gardenwalk, woods.** The garden walk (with its bollards) and the cove walk, looking along each walk under the
  canopy.
- **glade.** Standing in a glade off the Year Walk: the moss floor, ferns, paper birch at the edge and the hemlock
  wall behind. The moss is flat paint, so it reads a little like a lawn.
- **aerial** (golden and night, full and lite) and **fromBight.**
  - The aerial shows the dense woods, the Library in its clearing, the courtyard and the deck on the lip. At night the
    windows and the courtyard pools are lit.
  - fromBight shows the woods' skyline over the cliff.

## Measured

- **Canopy.** 60.8 % within 110 m (the sheet asks for 60–70 %).
- **Trees.** 436 real front-row trees and 912 woodland cards behind them.
- **Budget, district with the baked land.** 140.9k full and 59.1k lite triangles, against 150k and 60k.
- **Draw calls.** The dressing makes 15 full and 14 lite.

## Rough, honestly

- **The woods are mostly conifer from the walks.** The lite budget allows about 30 front-row paper birch, so the walks
  are lanes of tall hemlock (spruce/balsam) whose skirts close in. The cove walk is the tightest.
  - The front rows at a walk's edge are drawn smaller than those behind, but the kit's spruce is skirted to the ground.
    Trunks show mostly under the birches and pines.
  - More birch, or a walk-edge species with a higher crown base, needs lite budget. A birch costs about 80 lite
    triangles more than a spruce.
- **Card shapes.** Newfoundland draws every woodland card as a spire. On lite, where fewer real trees stand in front,
  some spire cards read as a diamond on a stick against the sky (courtyard, lite).
- **Bollard light.** The bollard bead (the runtime's card pair) is a large white globe and its pool a flat warm disc.
  That is the island's threshold light, not a Scholars'-only look.
- **Owed by the kits and runtime** (D-WW179): light shafts, mist and fog × 1.3 under the canopy, logs, stumps, boulders
  and the spur's edge stones. The bell cote, the elevator's beacon and the ferry are other places' builds.
