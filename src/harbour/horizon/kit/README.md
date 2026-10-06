The Horizon kit (STYLE §3). `road/` is the road corridor's kit (ROAD.md §4): pure card-kit geometry builders for the
corridor's pavement painting, markings, guard kits, lamps and scenic stops in three dressings; `runtime/corridorArt.ts`
and `runtime/cards.ts` bind them to the world. `road/fixture.ts` + `road/sheet.ts` + `road/sheet.html` are the kit's
synthetic fixture and dev render sheet (`scripts/horizon/kit-sheet-road.mjs`).

`plants/` is the planting kit drawn by `runtime/corridorPlanting.ts`: Mountain v2's trees and shrubs, the corridor's
palm, flower beds and grass, and The Water's Way species (`species.ts` table, `wwGeometry.ts`, `oak.ts` for the Old Oak):
reeds to the oak, each with its own layer, far family, lite share, wind, ink shell and season looks, in three dressings.
Neighbourhood plants (`neighbourhoods/types.ts` `PlantRecord`) are fed in as plant items. Sheets:
`scripts/horizon/kit-sheet-plants.mjs [--set ww|oak]`.

`props/` is The Water's Way prop kit (`index.ts`: `drawProp`, `propCollision`, `propIsEssential`): every `PropKind` in the
card kit, three dressings, collision only where asked and physically blocking, lite keeps essential props whole. The
island lantern is the road kit's 2.6 eu lantern post (`road/lamps.ts` `bridgeLantern`). Sheet:
`scripts/horizon/kit-sheet-props.mjs [--focus kind,kind]`.
