# Funicular Foot v5 independent source review

Read-only review of `/tmp/mountain-funicular-final-candidate.patch` and `/tmp/mountain-funicular-foot-regression.patch`, against current checkout source. Input hashes are in `/tmp/mountain-funicular-v5-review-inputs.json`. No modules imported, world built, tests run, GPU used or checkout edited. One small saved-world JSON read confirmed the current served Foot structureIds convention. Candidate comments were treated as design claims, not proof.

## Actionable findings

### P2 — isolate a walking-join region's ground cache even without horizonGround

`src/harbour/horizon/regions/mountainV2/index.ts`, `createMountainV2Region` groundCache initialization (current source65; proposed≈68), plus `ground.ts` prepareRegionGround key.

The new option can be supplied independently: `createMountainV2Region({walkingJoinSolids})`. The factory still creates a private cache only if `horizonGround` is set. Otherwise mount uses the module-global `prepared` map, and both the walking-cap and no-option region use the same `${tier}:${terrainStep}:yield` cache key because each has a groundCeiling function. Whichever mounts first wins: a prior default lattice can bypass the new cap; a capped lattice can leak into a later no-option/default region preview. The normal full runtime passes horizonGround and is already isolated, so this is a concrete supported-options/native-default seam rather than a claimed current runtime failure.

Minimal fix: create an instance cache whenever horizonGround **or walkingJoinSolids is supplied**. A small regression should mount/prepare the two variants in each order and ensure their positions do not share the capped buffer. Any direct custom-cap prepareRegionGround caller must also use its own explicit cache. Sent to modes_probe and root.

### P2 — retain the actual art/ground regressions, not only floor-query regressions

`test/horizon-foot-lane-apron.test.ts`, new funicular describe block.

The permanent patch exercises physical triangles, floors, slopes, continuous offsets, station-fringe points and extracted runtime walking. It never invokes `funicularFootPathPlacement` or the final `prepareRegionGround` cap. Thus restoring the old floating native ribbon, dropping per-fan cleanup, or omitting the exact render-lattice cap could leave all these added assertions green. Those were measured v3 defects, including real plank-fringe drawing/query disagreement.

Keep a bounded actual placement/ground regression using this fixture's final cuts: verify final full/lite ground overlap clearance, emitted fan validity using the unchanged geometric predicates, and ribbon heights over the actual composed floor including the previously measured fringe. Theme geometry is shared, but testing the actual callback at least once per tier is necessary; the root-run all-theme proposal proof establishes current behavior separately. No threshold relaxation is proposed. Sent to modes_probe.

## Reviewed without an additional source defect found

- `funicularFootStationTop` consistently derives the unchanged native station's actual rectangular plank top (5cm width/end overhang) from its exported axis. Both the geometry fitter and placed art call the same helper. Native source and no-option path art receive no geometry modification.
- New `projectBoundaries` partitions retained polygons along the two fixed station triangles' boundary lines before projection. It preserves both sides, uses existing host subtraction separately, and does not replace the source path plan. It may add subdivision beyond an edge inside the rectangle AABB, but those vertices are evaluated against the same final height field.
- With `projectInserted=true`, every vertex passed through the clipping append stage is assigned the final lower/upper-clamped height rather than the prior minimum of stale interpolation. Existing Foot/default clipping keeps false and its original lower-only behavior. Host incompatibility throws rather than silently flattening the native road.
- Important precision of the claim: unchanged `sealFootJoin` can subsequently add barycentres by averaging an already triangulated face. These preserve that face's plane and topology; they are not new evaluations of the nonlinear analytic height function. The final mesh remains the physical authority. Do not claim every final vertex equals height(x,z) without checking that stronger invariant. The existing independent all-face slope/query tests are the relevant acceptance, still unexecuted here.
- Core wiring passes final walking solids from runtime → region options → analytic ground ceiling and cap → prepared/rendered ground → path placement. The placement hook is gated on the explicit funicular apron ID and the native route builder's optional default remains unchanged. The consumer patch supplied separately must accompany this core change.
- Fixture reconstruction removes both served apron logical IDs from cuts and floorSource, uses uncapped pre-fit ground exactly once, then creates the final region after the fitter mutates cuts.solids. Unrelated geometry and path plans remain independently compared. The currently served structureIds use logical IDs without @district suffixes. Source fixture idempotency and physical tests are meaningful, subject to execution.
- The root-reported stray quote / broadened first-apron find / unused witness variable were acknowledged as already being fixed by the author, so they are not duplicated as new findings here.

## Limits

This source review does not establish final slope maxima, manifold topology, no-contact movement, exact full/lite terrain containment, art/frame time, or native scene parity. Root's serialized v5 proof and subsequent unchanged regression runs must establish those. No new scope or geometry revision is requested beyond the cache isolation and retention of the actual known-failure regressions.
