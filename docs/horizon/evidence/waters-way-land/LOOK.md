# The Water's Way, PR 2 "the land": before and after

**SwiftShader, not device evidence.** Every image here was rendered headless in Chromium on the SwiftShader software GPU
(`--use-gl=angle --use-angle=swiftshader`). They show the shape of the land, not frame rate, colour accuracy or what a phone
draws. Each image has two halves at the same camera: **left, "Before (base bake)"** is the PR 1 land (claude/waters-way-common);
**right, "After (merged land)"** is this branch. Both are bare land: no buildings, plants, props or lamps, because those come in PR 3/4.
In these frames a grey box is a placeholder footprint and a thin dark line in the sky is a cable or ferry line, not anything new.

| Image | Where | What to look at |
|---|---|---|
| `01-hl_horn-before-after.jpg` | The Highlands crown, looking along the east rim | Small changes: the ridge right of centre is a sharper spur (V3.1's benches as shelves on spurs). The falls, the road and the coast are where they were. |
| `02-hl_rim-before-after.jpg` | On the Rim Walk, looking at the horn | The horn reads as a sharper peak with a shoulder (the two arêtes) instead of a rounded knob. |
| `03-hl_lake-before-after.jpg` | Across the high meadow towards the cirque headwall | The headwall's top: the dark notch at the top of the face is gone and low pads now sit along the rim. The cable line top right is the existing one. |
| `04-veil-before-after.jpg` | The Veil amphitheatre from the Stillwater side | One curved amphitheatre: the old notch and dark slab at the top of the cliff are gone; low structures sit back on the rim (the Spur-crown bench). |
| `05-fallswatch-before-after.jpg` | From the west buttress (Fallswatch) out over Stillwater | The view the Fallswatch deck is for: the lake below, the Reach and the coast beyond; the Greenway's line shows on the far right. |
| `06-hamlet-before-after.jpg` | Above Bench Hamlet's shelf | The shelf in the middle of the frame is one broad flat terrace (the Bench Hamlet shelf, ≥ 60 × 35 at ≤ 8 %) where the ground stepped before; the blue channel running right is the water's new line. |
| `07-reach-before-after.jpg` | The Reach boardwalk, looking north to the High Span | The boardwalk and its bays now carry open timber rails (posts and rails you can see through) instead of solid sides. |
| `08-notch-before-after.jpg` | Standing on Notch Bluff | The new lookout deck with its open rail in the foreground; the Greenway's deck runs across the marsh beyond. |
| `09-greenway-before-after.jpg` | High over the Reach marsh, looking north | The Greenway's deck and its scraped marsh pools (the small blue patches), the Reed Maze trail, and the deck reaching the bluff. |
| `10-twin-before-after.jpg` | Low over the Green, looking at the crown | The Greenway on its piles crossing the meadow, with the pools behind it. |
| `11-calendar-before-after.jpg` | From the Green Road, looking north-east | The Greenway bridging over the walks on its piles (headroom over the Year Walk), the pools beyond. |
| `12-quay-before-after.jpg` | Little Harbour's quay, looking at the square | Almost nothing to see from here: S3's 8 m move inland at the quay is out of this frame. Kept as the "nothing else moved" check for the square and the bank. |
| `13-pier-before-after.jpg` | Long Sands, from the Tideline park | The new pier (shortened to z 1520 so the ferry passes) with its open rail, the wheel's platform at its end, the ramp from the park, the promenade and the Strand across the foreground, and the sunken skate bowl beside the park. |
| `14-scarp-before-after.jpg` | Below the Glasshouse scarp, from the Green | The sheer scarp becomes a battered, planted face with the stair-and-ramp zig-zagging up it. |
| `15-scholars-before-after.jpg` | Over Scholars' Edge | The Library's south-west courtyard terrace pad, and the Bight lookout spur and its deck on the cliff edge. |
| `16-bightlook-before-after.jpg` | On the Bight lookout deck, looking at Westwatch | The deck's open rail in the foreground; the chapel's spot on the far crown is the sight-chain target. |
| `17-flats-before-after.jpg` | The Flats beside the strip | The stargazing pad (the cut-off block at the left edge is a structure the frame clips) and the new pad across the road on the right; the strip itself is unchanged. |
| `18-batter-before-after.jpg` | The Bight Shore plots from over the lagoon | The plots' lagoon faces are battered (sloped, real ground) where they fit; the rest stays wall (the partial batter), and the Greenway runs along the foot. |

## The Journey map (`journey/`)

AGENTS.md (Jonathan, 2026-10-05): a big structural Horizon change shows on the Journey map. These pairs are the Journey map
(the Horizon Clock's clay island, #586) drawn twice by this branch's renderer: **left, before** is the Journey land baked on
PR 1's head (`4104445`, `claude/waters-way-common`); **right, after** is this branch's bake (identical in every later commit of
this PR). Only the land data differs. **SwiftShader, not device evidence.** Made with
`scripts/horizon/capture-journey-land-diff.mjs` (the command is at the end); `journey/captures.json` lists every file, the two
commits and the land's triangle counts.

What the clay map draws: the coast, the terrain on its 20 m lattice, lakes and streams, roads and the bridges that carry them,
toy houses and trees, and the landmark pins. It does **not** draw walks, skate lines, piers, decks or rails. So on the map:

- **Shows:** the Highlands' new ground (the horn, the Veil amphitheatre, the hamlet shelf: 38 lattice points move, up to
  +16.6 m and −35.2 m), the second stream (the Hollow Beck, a new brook from Hollow Tarn west to Orchard Brook) with the
  Hollow Beck Bridge's plank under Green Road, the Glasshouse scarp's batter (up to +18.8 m), the Bight Shore batter (up to
  +21.8 m), and the reshaped Rillcut and Hollow Rill streams. 86 of 9,191 lattice points move by 0.5 m or more; the rest of the
  island is unchanged.
- **Does not show (by design of the map, not missing from the land):** the Greenway, the Reach boardwalk's open rails and the
  lookouts, the Long Sands pier and promenade, the Glasshouse stair, Town Weave's 8 m move (a skate line), the Bight lookout
  deck and the stargazing pad. Whether the Journey map should draw the Greenway (a walk, like the Year Walk it would sit
  beside) is a Journey design call, not part of this land PR.
- **Noise to ignore:** the toy houses and trees are placed by rule from the land, so a few shift a little or take another roof
  colour between the two halves.

| Image | What to look at |
|---|---|
| `board-{classic,taylor,newfoundland}-{full,lite}.jpg` | The whole island on the real Journey board (Month, 1100 × 800, the fictional demo kitchen). At this size the two halves are almost the same: the land changes are a few lattice points each. Three themes, full and lite. |
| `highlands-classic-{full,lite}.jpg` | The crown from the south. Right: a new short stream (the Hollow Beck) runs west from the small tarn in the middle of the frame to the brook on the left; the Rillcut stream above it is redrawn as a fork. The horn and the Veil's rim move by a few lattice points (subtle at 20 m). |
| `reach-greenway-classic-{full,lite}.jpg` | The Reach and the meadow from the south. Almost nothing changes on the map: the Greenway and the boardwalk rails are structures the map does not draw. |
| `harbour-quay-classic-{full,lite}.jpg` | Little Harbour's quay. Unchanged (S3 is a skate line; one lattice point moves 1 m). |
| `sands-pier-classic-{full,lite}.jpg` | Long Sands. The coast is unchanged; the pier is not drawn; the toy houses re-place. |
| `green-scarp-classic-{full,lite}.jpg` | Stillwater (the pale oval), the Glasshouse (the yellow host on its west shore) and the scarp down to the Green below it. The batter raises about ten lattice points just south of the lake by up to 18.8 m, which on the clay is only a slightly fuller slope: hard to see at this scale. |
| `west-scholars-flats-bight-classic-{full,lite}.jpg` | The Bight's U, Scholars' Edge and the Flats. The Bight Shore batter fills the plots' lagoon faces on the U's east shore (up to 21.8 m on a few lattice points): a slightly fuller shore, hard to see at this scale. The coast, the Flats and Scholars' Edge are otherwise unchanged. |

**Budget** (`src/journey/land/clay.ts` `JOURNEY_LAND_BUDGET`: 25,000 / 15,000 triangles, 20 draw calls): the land alone
(no member homes) is full 19,212 → **19,230** triangles / 10 draws and lite 13,472 → **13,490** / 11; with the demo's homes
and dressing it stays inside the budget (`test/journey-land.test.ts`). The old 15,000 lite overrun the L-builders reported
was measured on the pre-#586 `build.ts`, which drew the walk lines; the clay does not, and nothing needed trimming.

Reproduce (from the worktree root, ~2 min):
```
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers BEFORE_REF=4104445 OUT=docs/horizon/evidence/waters-way-land/journey \
AREAS='[{"id":"highlands","at":[1090,440],"span":620,"themes":["classic"]},{"id":"reach-greenway","at":[1170,1190],"span":520,"themes":["classic"]},{"id":"harbour-quay","at":[1440,1265],"span":320,"themes":["classic"]},{"id":"sands-pier","at":[1010,1470],"span":320,"themes":["classic"]},{"id":"green-scarp","at":[1050,915],"span":360,"themes":["classic"]},{"id":"west-scholars-flats-bight","at":[640,760],"span":780,"themes":["classic"]}]' \
node scripts/horizon/capture-journey-land-diff.mjs
```
