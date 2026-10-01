# Bounded physical-mesh reduction proposal

Status: source/data review only. `experiment.mjs` is prepared and syntax-checked, **not executed**. No checkout or native-source changes.

## Budget facts

Actual current baked card capacity adds 33,298 full / 29,360 lite triangles in Lakeside, before separate art and ground layers. The current served funicular apron contributes 16,036 in both tiers (6,573 upward triangles according to the completed parent inventory). Even deleting that entire feature would leave 13,324 added lite triangles, already over 10,000. No funicular-only experiment can establish ROAD §8 acceptance.

Other named Lakeside costs from the supplied source ledger:

- Fitted `*.footJoin` solids: 6,148 triangles, same full/lite.
- Main `mountainV2.footLane.apron`: 2,004.
- Stillwater tunnel: 5,944 (walls 1,860; footings 1,860; floor 932; roof 932; apron 360).

These are current source counts, not asserted achievable savings. The canonical-ground proposal separately adds 4,515 top triangles in its saved second proof; those must also enter the combined budget. It is outside this first experiment.

## Existing suitable API

Installed `meshoptimizer` is 1.2.0. Its local declaration/documentation exposes:

```ts
MeshoptSimplifier.simplifyWithAttributes(
  indices, localFloat32Positions, 3,
  new Float32Array(), 0, [], vertexLocks,
  targetIndexCount, errorInMetres,
  ['ErrorAbsolute', 'LockBorder', 'Sparse']
)
```

This returns indices referencing the original vertices. Use **original double coordinates** for candidate geometry; local Float32 is only the simplifier's optimization input. Keep the whole logical `renderOrigin`. Do not use `simplifyWithUpdate`, `simplifySloppy`, `Permissive` or `Prune`. In particular, Prune can remove components containing locked vertices.

Existing `world/lite.ts` does not solve this task: it only changes render LOD while full collision remains unchanged. Its raw-prism path uses `prismLod.ts` with 10 cm error, 15 cm join acceptance and width allowed to halve. Those settings cannot be reused for a 1 mm physical-surface contract. The installed API can be reused; the acceptance policy cannot.

## First experiment: boundary-locked source indices

The supplied runner parses only the already-baked JSON, with no TypeScript/world generation. It extracts the one served logical funicular apron and verifies the source is a closed oriented indexed manifold. Split into upward top, downward bottom and vertical wall faces. Keep every wall triangle verbatim. Lock every top and bottom perimeter vertex. Conservatively lock transitions between horizontal host patches and non-horizontal top faces; before production adoption also pass explicit station/plank/capsule constraint segments from the existing source construction.

Run three small trials: requested error 0, 0.25 mm and 0.5 mm; target 20% of the original top/bottom triangle count, allowing the library to stop earlier. Simplify top and bottom independently, rejoin them with the untouched walls and original positions. This does not equate a library-reported error with measured acceptance. Each candidate is explicitly marked unaccepted, even if preliminary gates pass.

The runner reports actual boundary-edge equality, locked counts, closure/winding, upward-face grade, runtime-invisible face count, output triangle count and reported library error. It writes original/candidate JSON and a progressively saved study. It never rewrites the served asset, source code or a tier-only mesh.

Root invocation, with a new output directory:

```sh
node /tmp/mountain-mesh-reduction-proposal/experiment.mjs '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' /tmp/mountain-mesh-reduction-study
```

If zero-error reduction is material, prioritize it. This is a candidate generator, not proof that floating-point plane matching is exact. Flat-plane normals and shade thresholds must be independently compared. Current `solidTriangle` uses face normals, a constant role/surface color and world-linear UVs; it does not seed a new random color per triangle. Exact coplanar merging therefore has a plausible appearance-preserving path. Approximate merging changes normals and still needs visual checks.

## Required independent gates before applying a candidate

1. **Exact topology and constraints:** same boundary vertex coordinates and edge sequences, same connected components and holes; each whole-solid edge has two opposite incidences; no duplicate/zero-area/inverted face. Match every explicit station and fixed-host constraint segment. No internal host segment may be replaced by a diagonal crossing its boundary.
2. **Measured surface error, not vertex sampling:** spatially index original and candidate height-field triangles. Form all positive-area XZ intersections (common refinement). Each height difference is affine there, so evaluate every intersection polygon vertex for the exact maximum positive/negative deviation. Check coverage in both directions and boundary loops. Require <=1 mm on both top and bottom; report the maximum witnesses and area. This catches a triangulation crossing a ridge even when all retained vertices themselves are unchanged.
3. **Thickness:** common-refine candidate top and bottom too and require >=0.1 m at every overlap vertex, plus unchanged closed walls and no plan-coverage holes. Independent top/bottom reduction must not quietly thin a previously exact 0.1 m region.
4. **Physical and rendered arithmetic:** every upward face <=40 degrees; runtime plan determinant >=1e-8; no degeneracy/inversion or new steep face after actual bake9 and local-origin Float32 transforms. Preserve origin and material/bed/source metadata. Recompute bounds without altering origin per partition.
5. **Host seams and specific regressions:** exact perimeter/host equality is mandatory, not merely 1 mm. Rerun all six previously failing lip neighborhoods, full-width native/Year Walk/town sweeps, 14 ordinary walker attempts, actual old/new post attribution, all six theme/tier art variants and actual common-ground support. Check contact/ceiling as well as floors. New topology can change broad-phase/contact behaviour despite a small vertical error.
6. **One physical mesh:** if adopted, replace source `positions/indices` before serialization/partition. Both drawn and collision consumers use it. Clear stale `litePositions/liteIndices` for these repaired solids or explicitly emit the same resulting mesh to both tiers. Never change only drawing or only physics.
7. **Combined budget:** rerun real card capacity together with corridor art/plant/light and common-ground capacity per district. Keep 25k/10k and 12 submissions. No partial layer count is acceptance.

Run only the cheap study first. If it gives negligible reduction, do not spend an expensive full proof. Retain v20 and its successful local source proof until a measured candidate passes.

## Exact coplanar merging and Stillwater

A deterministic alternative for zero-error surfaces is to join adjacent equal-plane triangles into planar patches, remove only **interior** vertices and triangulate while retaining every constrained perimeter knot and hole. It needs a robust constrained triangulator and exact common-refinement check; simple fan triangulation risks the skinny-facet failures already encountered. Meshoptimizer's zero-error trial is the smaller first experiment.

Stillwater's generic `tunnel()` emits separate slab prisms per route sample. Floor segments deliberately overlap by `FLOOR_LAP=.5` to prevent outer-bend wedge holes. Their side faces are **not automatically duplicate internal faces**. Roof/wall/footing segment end planes may overlap or leave angled junctions. Never delete all segment caps or coarsen the centreline blindly.

A narrow next study should first count genuinely coincident opposite-oriented triangle pairs within each logical material/role solid after exact-coordinate welding. Only remove a pair if it is a proven shared internal face of adjacent volumes; then reconstruct the union boundary and verify closure. This preserves every exterior point and can expose longer coplanar patches for exact merging. Different surface/role solids stay separate. For noncoincident overlaps, robust solid union is a separate operation, not a tolerance-based cancellation. Preserve portal openings, floor lap, clear headroom and support depth.

Only after that exact inventory should any tunnel height-field simplification be considered. The walls/roof need their own fixed portal and junction constraints and exact signed surface error; the funicular top/bottom routine is not automatically a safe wall simplifier.

## Why not v22 now

The unrun v22 hint-coalescing proposal changes source sampling before clipping. Its predecessor v21 removed all hints and produced real nonmanifold edges, not duplicate faces. Coalescing might reduce columns but gives no 1 mm bound or host-topology guarantee. It is less predictable than simplifying the accepted final mesh while fixing actual boundary vertices. Keep it retained, unexecuted, and out of the first experiment.
