# Little Harbour, "cobblestone Italy" — how it looks (The Water's Way, PR 3)

**SwiftShader, not device evidence.** Headless Chromium with SwiftShader on the runtime review page
(`horizon-review.html?world=horizon&tier=…&theme=…&date=2026-06-21`), 1120 × 700, JPEG q 70. Shot by
`scripts/horizon/capture-harbour.mjs` on the final bake of this branch (the working tree that became the finishing
commit; `captures.json` names its parent SHA). 45 shots, 0 errors. Times are Toronto civil time on 21 June:
golden 19:55, dusk 21:05, night 22:30, noon 13:00.

File names: `<pose>_<hh-mm>_<dressing>_<tier>.jpg`.

## What to look at first

- `mouth_19-55_*_full.jpg` — the town from the harbour mouth: Lantern Row's quayfront, the tiers climbing behind it,
  the campanile on top. The best single read of the place in each dressing (Classic Ligurian stucco and coppi, Taylor
  pastel card, Newfoundland jellybean clapboard on the same massing).
- `belfrySouth_19-55_*_full.jpg` — "over the roofs" from the belfry: coppi roofs, altane with pergolas, laundry across
  the lanes, the orti olives on the lawn inside Town Weave's bend, the ferry and the sea.
- `vicolo_13-00_*_full.jpg`, `market_13-00_classic_full.jpg` — inside the lanes: arcaded shops, persiane, balconies,
  window boxes, bougainvillea, lemon pots, laundry overhead, the verges cobbled wall to wall.
- `square_19-55_*` / `square_22-30_*` — the piazza: the campo in two bricks laid by fan between ten travertine rays,
  the fountain, café tables, the campanile; at night the Court's lanterns and the lit shopfronts.
- `lanternRow_22-30_*` and `pageL_22-30_*` — Lantern Row at night (the island lantern, west → east).
- `aerial_19-55_classic_full.jpg` — the whole town; the campo's fans read like Siena's from the air.

## Pages, porch and lookouts

| Shot | What it shows | Verdict |
|---|---|---|
| `pageA_19-55_*` (MANIFEST pose) | the square's north-west corner to Mountain v2's dam | The dam corridor is clear (no dressing over 6 eu on it), but the frame is mostly **the land's grey retaining walls** under the bank and the Kitty plaza — greybox, not dressed. Owed to the land/runtime (stone re-materialling, SPEC §7), not fixable from the module. |
| `porch_19-55_classic_full` | the prototype's porch eye, same line | Same walls; the campo's brick now reads as brick, not earth. |
| `belfry_19-55_*` | from the belfry north | The town below and Mountain v2 beyond; the dam itself is small behind the land's ridge (page A's proof gives it 26 px). |
| `belfrySouth_19-55_*` | over the roofs | Good. |
| `belfryWheel_19-55_classic_full` | the wheel viewer's line through the west arch | The line leaves through the arch (tested). The Ferris wheel itself is Long Sands' record, not in this branch: only the pier end shows. |
| `springBay_19-55_classic_full` | Spring Bay to the campanile | The campanile's belfry and cap stand clear over the High Span's rail (sight chain). |
| `pageL_22-30_*` (MANIFEST pose) | the quay at night | Lantern Row and the lit quayfront; the near ground is the land's quay slab. |

## Lite

`pageA`, `mouth` at golden and `square` at night in all three dressings: lite drops the set dressing (café tables,
gozzi, laundry, crates, the lane verges' setts) and keeps the town, the lanterns, the campo, the bocce court and the
benches. Lite reads as the same place.

## Rough, honestly

- The land's retaining and shoulder walls in the town are flat grey (page A, the porch, the bocce shot): the prototype
  re-materialled them in warm stone; that is a land/runtime material change.
- The campo sits in warm shade at golden hour by design (D-WW135); in shade the brick is dark. Two bricks by fan keep it
  from reading as bare ground.
- The upper street's setts are one flat tone over 19 × 72 m (no joint lines: the lite budget).
- The beds' own surface stays the land's pale gravel; only their verges are cobbled.
- Taylor's bunting and Newfoundland's root cellars are not drawn (a record is the same in every dressing); Taylor draws
  the square's festoon as her concert-light string.
