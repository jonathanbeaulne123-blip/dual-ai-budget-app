# Road kit sheet (track K)

`node scripts/horizon/kit-sheet-road.mjs` (full tier) and `node scripts/horizon/kit-sheet-road.mjs --tier lite --only driver-developed_day,driver-mountain_day,driver-developed_night --port 5198`.

This is a synthetic fixture (`src/harbour/horizon/kit/road/fixture.ts`), not the island. It is a 132 eu curved road with three stretches:

- **Developed:** kerbs, flagged sidewalks, a zebra, lanterns 24 eu apart and staggered, bollards, and a side road with a give-way.
- **Coastal:** a post-and-rail with a buried end and flared ends, a gap for a flagged lookout with a wall, a bench and a lamp.
- **Mountain:** a cutting with a coursed retaining wall and weep holes on the hill side, a stone parapet with piers over the drop, and a centre solid line on the blind curve.

The corridor solids draw through the real `runtime/cards.ts` path. The dressing draws through `runtime/corridorArt.ts`. Terrain uses the Horizon `terrainMaterial`, and the sky dome, fog, sun and moon come from the runtime's own sky modules.

Captures are headless Chromium on SwiftShader at 1280×800, 2026-06-21. Day shots are 13:00; the stop shots are 17:30. Night shots are 22:30.

This is not device evidence. The warm ground pools at night are a sheet-only stand-in for track N's pools; the kit itself draws the lamp glass and halos.

Per-image draw calls and triangles are in `sheet-full.json` and `sheet-lite.json`. Those counts cover the whole frame, including the sheet's terrain lattice.

| File | What it shows |
|---|---|
| `{classic,taylor,newfoundland}_driver-developed_{day,night}_full.png` | Driver height (1.9 eu) in the developed stretch: zebra, lanterns, bollard, kerb and flagged sidewalk. |
| `{…}_driver-coastal_day_full.png` | The coast: post-and-rail on the sea side, the lookout gap, edge lines. |
| `{…}_driver-mountain_day_full.png` | The cutting: retaining wall with weep holes on the left, stone parapet with piers on the right. |
| `{…}_aerial_day_full.png` | The whole fixture from above and inland. |
| `classic_aerial_night_full.png`, `classic_driver-coastal_night_full.png` | Night: glow and halos, markings in night chalk. |
| `classic_kerbside_day_full.png`, `taylor_kerbside_night_full.png` | The pedestrian view: kerb joints, flag grid, bollard, lantern plinths. |
| `classic_parapet-close_day_full.png` | The parapet close up: coping, coursing and piers against the deck edge. |
| `{classic,newfoundland}_stop_day_full.png` | The scenic stop: flags, low wall with coping, end piers, bench and lamp. |
| `classic_driver-mountain-back_day_full.png`, `classic_aerial-sea_day_full.png` | Reverse direction, and the sea side of the parapet run. |
| `*_lite.png` | The lite tier: no wheel tracks, no joints, a single stone value. Posts are every 5 eu. |

**Verdict (the author's, not a blind review).** The Classic sheet reads as the next step of Mountain v2's road (`V2LIB_13-02`): the same warm banded surface with a paler crown and worn wheel tracks, dressed-stone kerbs with a chalked coping, and a coursed parapet with piers. Markings are restrained and follow the curve.

Taylor and Newfoundland are made of different materials, not just recoloured:

- **Taylor:** pastel card blocks with white paper edges, washi-taped rose posts and heart paper lanterns.
- **Newfoundland:** split grey granite, white gallows posts and galvanised storm lanterns on rope.

At night the lamps glow and the markings stay readable without turning into a wireframe.

Rough spots:

- **Parapet foot:** a thin cool line shows where the parapet meets the deck in low-angle close-ups (`parapet-close`). It is ambient sky on a 1–2 cm sliver between the deck's cut side and the wall. It is invisible at driving distance.
- **Kerb and flags:** stay Classic in every dressing. The baked land is built once, not per theme; see the report.
- **Headless renders:** SwiftShader flattens the shadow softness.
