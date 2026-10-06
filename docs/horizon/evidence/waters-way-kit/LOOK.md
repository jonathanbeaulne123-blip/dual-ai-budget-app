# The Water's Way — kit sheets (PR 1, common ground)

Headless captures of the new kits on a test ground, not on the island (nothing on the island changes in PR 1:
no neighbourhood module exists yet, so the bake is byte-identical). SwiftShader, not device evidence.

- `buildings_*` — the building grammar (`kit/buildings`): every kind in its style sheet; harbour also in Taylor's
  Scrapbook and Newfoundland, and at night (lit windows are emissive cards, no point lights). `street` is ten row
  houses packed on a slope, the way Little Harbour's solver will place them.
- `ww-plants_*` — the 24 new plant species through the existing planting machinery, in three dressings.
- `ww-oak_*` — the Old Oak, the Green's landmark (its own layer, kept on lite).
- `ww-props_*` — the prop kit: the Lookout kit (free-lever viewer, bench, panel, open rail), the island lantern,
  fixtures for the pastimes; `p2 … night` shows the glow cards.

Full sets (53 building sheets, all plant seasons/tiers) were reviewed during the build and are reproducible with
`node scripts/horizon/kit-sheet-buildings.mjs`, `kit-sheet-plants.mjs --set ww|oak`, `kit-sheet-props.mjs`.
