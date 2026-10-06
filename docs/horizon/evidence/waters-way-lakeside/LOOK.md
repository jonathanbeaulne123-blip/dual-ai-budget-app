# The Green (module `lakeside`): what the captures show

SwiftShader, not device evidence. Headless Chromium on the review harness (`scripts/horizon/capture-green.mjs`), June 21
(dandelion clocks out), 1280 × 800. Files are `<pose>_<hh-mm>_<dressing>_<tier>.jpg`; `captures.json` holds every eye,
target, fov, time and the whole-scene draw calls and triangles. `oak/` holds the plant kit sheet of the Old Oak
(`kit-sheet-plants.mjs --set oak`): from 95 eu, under the crown, from 260 eu and from 1 km at about 64 px, in each season and
dressing. `base/` (if present) is the same poses on the PR 2 head with no dressing, for the draw-call baseline.

## The Old Oak

- **It reads as an oak now.** The PR 1 oak was a flat-topped acacia: a parasol of flat pads on a tall trunk, black underneath.
  The new one is a broad dome of rounded billows on a short, heavy, fluted trunk, with low, crooked limbs that run out
  almost level. See `hero`, `clock` and `oak/`.
- **From far away.** From Fallswatch (472 m, `fallswatch_07-30`), from the Crown (page E) and across the meadow from the
  porch (`porch_10-00`), it is unmistakably a big, broad, solitary tree. Before this change, any view from outside the
  oak's district drew the landmark as a slim grey obelisk. Now the far silhouette is the kit's own oak (lite tier, in the
  season's look, at the plant's yaw). See `porch_10-00_classic_lite` and `hero_12-00_*_lite`.
- **Under the crown** (`canopy`). The undersides are a pale olive-sage, never black. You can see the limbs, the fluted
  trunk, the ring bench and the swing.
- **Seasons and dressings** (`oak/`). In May it is fresh green, in October bronze, in November russet. In winter it is bare,
  with a twig dome and snow along the limbs. Taylor is pastel; Newfoundland is darker and cooler.

## The Green

- **The Oak Clock** (`clock`). Twelve stones on a mown ring, with the picnic tables at the drip line, the ring bench and
  the swing. In Classic and Taylor the ring and the desire lines read clearly. In Newfoundland the mown paint is close to
  the turf's own colour, so the ring and the lines are faint.
- **The turf labyrinth** (`labyrinth`, best in Taylor). Seven circuits with long-grass walls, the entrance toward the Year
  Walk, and the two new desire lines from the Glasshouse stair-and-ramp meeting at the labyrinth.
- **The apiary and the kites** (`apiary`). The hives sit in the clover; only the kite lines are visible.
- **The rim.** The windpump, the hay bales and the windsock are in `rim`. The Meadow Pavilion is in `pavilion`; its
  surroundings are bare because the bight district has no budget left (D-WW115).
- **The meadow.** The wild drifts (clover, daisy and black-eyed Susan; goldenrod and milkweed; dandelion clocks in June;
  lupine in Newfoundland) and the long grass are concentrated where people stand and look. The open middle of the Green
  is still plain turf.
- **At night.** The Lantern Ring reads as a ring of warm pools in the aerial (`aerial_22-30`). From the ground
  (`night`, `porch_22-30`) the oak is a strong silhouette, but the ring's posts are small. The Glasshouse is the first
  light (page E at 22:30).

## Pages and porch

- **E (noon, night).** The oak stands on the Green's rim below the Crown.
- **K (dusk, noon).** This page is dominated by the Glasshouse's greybox wall. The kit has no Glasshouse building kind, so
  the host is not re-dressed here; the module dresses its surroundings only. The shore planting is light (the lakeside
  district's lite budget), so it hardly registers in K.
- **Porch.** From the stair's foot landing, south over the meadow to the oak.

## What's rough

- Whole-scene draw calls at several poses are over CONTRACT §6's 400 full / 180 lite. Each of this module's districts
  adds about 15 draws (index: green 23, notch 23, lakeside 30, land included). `base/` gives the comparison. See
  `captures.json`.
- Newfoundland's mown paint has little contrast.
- Page K needs a Glasshouse re-dress.
- The meadow is thinner than the prototype, because of the budget.
