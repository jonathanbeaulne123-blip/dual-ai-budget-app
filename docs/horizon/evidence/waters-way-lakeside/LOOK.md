# The Green (module `lakeside`): what the captures show

SwiftShader, not device evidence. Headless Chromium on the review harness (`scripts/horizon/capture-green.mjs`), June 21
(dandelion clocks out, fireflies on), 1280 × 800. Files are `<pose>_<hh-mm>_<dressing>_<tier>.jpg`; `captures.json` holds
every eye, target, fov, time, and the draw calls and triangles for the whole scene. The captures wait until the dressing
and corridor builders are idle, so no shot is taken while the Green is still building. This set is the re-shoot of
2026-10-12, after review.

## What changed after review

- **The meadow is a wild meadow, not a mown lawn** (`hero`, `meadow`, `porch`, `clock`, `aerial`).
  - Long-grass drifts about 40 m across, painted a dull olive. You can see them from the air and from the porch.
  - Inside the drifts the grass is a new wide tawny sheaf: knee-high outside the protected circle and no taller than
    0.85 inside it.
  - Between the drifts the turf is shorter and has flowers: clover, daisy, Susan and dandelion clocks.
  - A meadow now stands round the oak beyond the clock ring.
  - The landing field is short flowery turf round a mown target, with its chalk rings and terracotta centre.
  - The mown desire lines are 2.4 m wide and nothing grows on them. They are visibly shorter and greener (`porch`,
    `meadow`, `labyrinth`).
  - On lite the olive paint is dropped. The lite shots show the meadow as grass and flowers on the lawn colour.
- **The Old Oak is lobed, not tiled** (`hero`, `meadow`, `canopy`, `clock`).
  - The crown is irregular masses. Each mass has its own light and shade, with gaps where the eight limbs show.
  - The low tier sits apart from the high crown.
  - The rope swing hangs clear under the long WNW limb.
  - There is no ink shell, so at night the crown is one dark silhouette. The bright tile edges are gone.
- **Night** (`night`, `fireflies`, `porch_22-30`, `aerial_22-30`, `pavilion_22-30`).
  - Each lantern of the Lantern Ring has a warm glow and halo. From the ground they read as a string of lights round the
    rim. In the night aerial they read as a ring of pools.
  - The Meadow Pavilion's lantern and the Glasshouse terrace's low lanterns glow the same way.
  - Fireflies hang under and around the oak and over the long grass. They are still specks for now; PR 5 makes them
    fly.
  - Everything at night is emissive cards. There are no point lights.

## Pose by pose

- **hero** (noon): the oak over the meadow, with an olive long-grass drift in the foreground and the sea behind.
- **meadow** (11:00): standing in the long grass north-east of the oak, with a mown line and the clock ring beyond.
- **canopy** (11:00): under the crown. You can see the limbs, the fluted trunk, the ring bench and the swing.
- **clock** (11:00): the Oak Clock's twelve stones on the mown ring, the tables at the drip line, and the meadow drifts
  round it.
- **labyrinth** (10:00): seven mown circuits with long-grass walls, and the entrance toward the Year Walk.
- **apiary** (10:00): the hives in the clover. The kites are over the April station.
- **rim** (17:30): the windpump, the hay bales and the windsock. This is the landing district, which has no meadow
  dressing.
- **pavilion** (19:30, 22:30): the Meadow Pavilion lit on the west rim. Its surroundings are bare because the bight
  district has no budget left (D-WW115).
- **night, fireflies** (22:30): the oak against the sky, the fireflies and the ring's lanterns.
- **E** (12:30, 22:30): page E from the Crown. **K** (20:50, 12:30): page K, the Glasshouse over Stillwater.
- **porch** (10:00, 22:30): the stair's foot landing, looking south over the meadow to the oak.
- **fallswatch** (07:30): the oak from the west buttress, 472 m away.
- **aerial** (12:00, 22:30).

## What's rough

- Page K is still the Glasshouse's greybox wall. There is no Glasshouse building kind (owed).
- The meadow is denser where people stand and look. Far from those places it thins.
- The olive paint follows a 4 m grid, so its edges step slightly where a path or a keep-out cuts it.
- The Newfoundland mown paint is still close to its turf colour.
- Some poses draw more than CONTRACT §6's 400 / 180 calls for the whole scene. Each district this module dresses adds
  about 15 draws, and one more each for the firefly points and the lantern halos (`captures.json`).
