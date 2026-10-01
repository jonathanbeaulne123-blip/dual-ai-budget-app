# Dam crest: correct the metadata, do not build a bridge to justify an invented edge

## Decision

The narrow Horizon metadata correction is legitimate: it neither closes nor reroutes a physical path. A new east bridge is not required merely to validate the invented nearest-road chord. It is **not sufficient to claim ordinary continuous walking access to the crest**, because the actual native approaches retain measured or unresolved failures. Under a literal all-existing-footways walking requirement, those native approaches remain open work; they must not disappear from the audit inventory when this false chord is removed.

Patch: `/tmp/mountain-promenade-metadata.patch` (source + focused ownership test). Read-only `git apply --check` passes. Tests have not been executed. Pure saved JSON mapping proof: `/tmp/mountain-promenade-metadata/mapping-proof.json`.

## Correct source authority

`land/mountainV2/beds.ts` currently combines the 13-point landmark `V2.dam.promenade` with one nearest-road point. The 24.5221325 m final chord has no matching native pathGraph edge and is explicitly region-carried, so Horizon emits no deck for it. Both old landmark endpoints also miss the native crest graph endpoints by 1.2014132 m.

Use the exported `nativePlanning.walks['promenade:dam-crest']`: 37 points, 52.9689434 m plan length, constant H y=142, native source half-width 1.8 m. This is the native **walk/floor polyline**, not a claim that the crest artwork has 37 tessellation stations: `mountain/art/damArt.ts` independently draws a 24-section angular ring. The patch copies the precise source walk and width, marks paved material consistently with the native region graph, disables terrain cutting, and carries the whole route. Native drawn geometry, floor provider, dam, road, pavilion, stairs, and terrain are untouched.

## Actual approaches retained

- West: `stair:dam-west-steps`, from native road node `road:dam-stairs` to `dam:west`, 31.12643 m, 2.8 m source width. Earlier exact walking attempts failed both directions because reservoir water was above the stair; 33 sampled cross-sections were wet across all seven tested body offsets. This is a real physical access failure, not the phantom chord.
- East pavilion: `path:dam:east~door:pavilion`, 17.133565 m, source width 3 m. The native path proceeds to `district:reservoir`, then `road:reservoir`. The stored path drops to H y=123.468958 before rising to the y=144 pavilion; maximum sampled source chord grade is 392.888%. Ordinary paths follow ground rather than a new raised slab. No complete ordinary-controller access pass exists.
- East funicular: `path:station:funicular:reservoir~dam:east`, 13.291649 m, width 3 m; stored minimum H y=123.13029, max sampled chord grade 417.950%. `stair:reservoir-steps` also joins the station from `road:b3-east`. Connectivity in the source graph is not physical access proof. Prior east-bank ground/headroom witnesses were failures; no successful ordinary approach should be inferred.

These source-profile grades locate the problem; they are not a replacement for actual terrain/controller tests. The old failed west and east-connector results remain historical evidence.

## Consumers and effects

1. `land/beds/build.ts` includes the named promenade bed. Bed lines, intersection proofs, marks, district partitioning and baked `world/pathGraph.ts` consume its points. The next bake will truthfully end this bed at the east abutment, removing the spurious route edge and any labels/proofs derived from it.
2. `regions/mountainV2/graph.ts` independently maps **every** native `MOUNTAIN_PATH_GRAPH` node and edge with the fixed translation. Runtime `placeHorizonRegions` merges that graph via `withExtraGraph`. All native access edges and all existing seams remain unchanged. The proposed test asserts every native edge's endpoints, point sequence and width, not just a selected count.
3. `scripts/horizon/mountain-footway-routes.mjs` audits the named bed. Re-baking changes that one attempted itinerary to the actual crest. This must not be presented as fixing the old connector or as a pass for west/east approaches: retain the old failed attempt and name native approach attempts separately.
4. The L01 stop, local bay, view target and runtime `walkOut` are unchanged. A valid Look placement or graph connectivity does not prove a continuous walk from the road.
5. Native `pathGraph.ts`, `surfaces.ts`, `art/damArt.ts`, `art/routeArt.ts`, collision, water and terrain are untouched. The patch creates no hidden support, barrier, closure or span.

## Remaining verification

Run the focused mapping test after root releases the execution lane; then rebake and replay crest movement plus separately named actual access paths. Check the crest's real artwork/floor/kerb width at both abutments. The metadata test is explicitly not a physical clearance or controller acceptance test. A new bridge is only a distinct repair option if Jonathan requires repaired continuous access and an independently verified smaller existing-path repair cannot meet it; the metadata defect alone does not establish that necessity.
