# Foot exact-boundary candidate — scratch proof

Checkout was not modified by this agent. The “Read the final V03 entrance surface” comment is part of the original apron patch line92, applied by root. Both new patches pass git apply --check against the current checkout.

## Deliverables

- `/tmp/mountain-foot-exact-edge.patch`: continuous native edge envelope plus actual native footprint subtraction from local Horizon fitted meshes/apron. Native geometry and all route points unchanged.
- `/tmp/mountain-foot-exact-edge-test.patch`: named 35.5mm regression witness and its eight neighboring points. Existing tolerances unchanged. Proposed test not run under Vitest here.
- `/tmp/mountain-foot-exact-edge-probe.json`: dense composed-floor/contact geometry evidence.
- `/tmp/mountain-foot-exact-edge-modes/results.json`: four independent actual bicycle/walking attempts and traces.
- Reusable scripts `/tmp/mountain-native-branch-audit/foot-exact-edge-{probe,modes}.mjs`.

## Measured result

The named failure at H[1279.3497661352883,_,720.3418851595721] is now owned by `mountainV2:mountain-road`, y54.65334769182998. Double-precision source native y54.65334774339284 differs by approximately51.6nanometres. Fourteen dense sweeps (0.04m station spacing, both directions, offsets0/±2/±2.625/±3.4m) report zero contacts and zero native intrusions; maximum apparent native excess is1.7e-8m numerical precision. The historical35.5mm regression and the current baked27.9mm lip are preserved in earlier/current reports.

Both bicycle and extracted runtime walker completed the22.014m Foot lane in both directions, zero contacts, bails, airborne/off-bed frames, snaps, or restarts. Driver starts0.5m in and accepts the final0.5m end margin. Bicycle completed21.0278m forward in6.4s and21.0347m reverse in7.8167s; walking21.0402m each direction in8.7667s. Bicycle policy is the existing general ordinary-input pursuit; no location exceptions. These four short independent attempts are not a whole-chain or native-skate pass.

The prior V03 corner sample-frame discontinuities remain in JSON: when the offset frame rotates through the corner, successive station samples can jump2–4m in XZ; resulting raw height changes reach13.15cm at±3.4m. No event was removed or reclassified in the evidence. Foot interior dense steps are below0.06m; centre maximum is4.736mm. Actual uninterrupted corner traversal remains a final route-audit gate.

Local fitted plus apron source triangles drop from17,768 to16,584 (apron4,500; other local meshes12,084). This is not a final per-district draw budget. Full/lite partition and furniture totals still require bake/budget checks.

## Bake-order review

The current call is after buildLandCuts, resolveComputedCrossings, settleBedEdges, openRetainingPassages, groundTerrainBeds, settleFoundations, and settleCorridors; it is before createLandWorld/partitionWorldSolids/removeInternalFaces and prepareLiteWorld. Source bed/deck/shoulder/batter emitters use complete8vertex/36index prisms. Crossing/edge re-emission retains that topology; passage clipping copies/reconstructs whole prisms; groundTerrainBeds changes bottom height only. Corridor replacement targets road corridors, not the selected Year Walk/S1 primitives. The source-prism assumption therefore holds at the actual call point. This was reviewed from current source; the bounded shadow rebuilds selected source emitters and still cannot replace a full final bake.

The applied decomposition is necessary: unchanged prisms stay in the original solid, fitted local grids carry `.footJoin` ids and are appended after traversal. This preserves distant prism-chain LOD eligibility while keeping the same source ownership, role, surface, walkable flag, bed ids, and local physical geometry. Mixing a fitted grid into the original solid would disable whole-source prism simplification. Internal-face removal already occurs during partition; do not count those savings again.

## Safe further reduction proposal (not implemented)

Use one shared source mesh reduction for draw and physics, preserving every boundary knot. Merge only blocks whose existing top vertices are exactly coplanar within numerical roundoff and whose existing bottom vertices independently satisfy the same condition. Triangulate the retained boundary through an existing interior grid vertex; this preserves the planar surface and seam vertices while reducing large planar interiors. Keep curved native-approach envelopes and all nonplanar cells at their verified resolution. A uniform1m resample changes cone chords and is not exact; it needs new geometry/controller validation. No quantified additional saving is claimed.

## Limits

Walking uses the exact extracted runtime move function with gateOpen=true. Region is always active; streaming, final partition, camera/rendering, device feel and gates are not tested. Candidate-generated solids replace the bounded local source area in current baked surroundings. Root must apply, run the unchanged focused tests plus proposed witness, bake, check district budgets and replay actual routes before final acceptance. All failed prior variants remain retained.
