# Shared local ground — implementation-ready bounded design

Prepared from current source and the frozen local-art/v12 evidence. No production edits or execution. This is a design proposal for root to implement and verify; the final candidate's measured impact polygon and floor topology remain inputs, not invented accepted dimensions. The source geometry is still being repaired independently.

## Choice

Use **one region-owned local terrain patch**. Store a canonical top mesh in native coordinates, independent of `tier`. Draw that same top mesh in full and lite and query those exact triangle heights and normals inside its explicit footprint. Keep the old analytic ground and original native meshes outside it. This avoids introducing a static Horizon floor whose card residency differs from the native region's scene lifecycle.

A baked `StructureSolid` ground collar is also feasible, but adds a new static-floor/district-render lifecycle plus grass-material integration. The region-owned form is narrower because the existing region already owns, draws, caches and gates the affected native ground. No global terrain, native source, road frame, plank, route, controller or acceptance tolerance changes are needed.

## Source boundaries and API

Add a small Horizon-only `regions/mountainV2/walkingGroundPatch.ts` (or extend `walkingJoinGround.ts`) exposing:

```ts
type PatchFloor = { y:number; nx:number; ny:number; nz:number; slope:number };
type WalkingGroundPatch = {
  // Native coordinates; frozen Float32 positions are the final render/query values.
  positions: Float32Array;
  indices: Uint32Array;
  boundary: readonly (readonly [number, number])[];
  bounds: { minX:number; maxX:number; minZ:number; maxZ:number };
  // Exact plan membership. No expanded bounding box is floor ownership.
  floorAt(nx:number, nz:number): PatchFloor | null;
  sourceIds: readonly string[];
  fingerprint: string;
};
```

Construction accepts final apron triangles, original native ground with the already-approved road/yield ceilings, the final bounded patch polygon, and the actual road/plank/host constraints. It takes no render tier. Do not create a second collar per tier. Build/freeze coordinates before deriving normals, query buckets and proofs, so a Double-precision source triangle is never substituted for its actual Float32 drawing. Use the Mountain region's existing local origin rather than absolute kilometre-scale Float32 positions.

The data object is owned by the region generation. `createRegionGeography`, `prepareRegionGround` and `funicularFootPathPlacement` receive the same object/reference. Cache identity must include this generation, not only `tier` or whether a ceiling exists.

## Construction and outer ownership

1. Start from the **fresh final** impact inventory: the original analytic ceiling band plus all rendered triangles affected in either tier. Do not reuse v12 bounds as accepted source. Choose an explicit bounded polygon enclosing that local impact; record its dimensions, area and maximum height change. Its entire ground-owned region must satisfy `contains` and avoid native terrain mouth exclusions. This join lies near the Foot, so fail if the new polygon unexpectedly crosses the native/Horizon ownership boundary instead of extending the override into Horizon terrain.
2. The target inside is the original native ground capped beneath the approved actual apron/hosts, using the existing physical clearance. The outer contour returns to the **unchanged analytic native floor**, not one tier's approximate old mesh. It must not silently raise the source road, move a platform, fill an underpass or alter a source water floor. At `yield` overlaps, preserve the existing ground-below-real-Horizon-deck rule; the static deck and native plank remain the higher surface candidates. `provider.owns` continues to use the current `contains` semantics, rather than replacing it with the collar's bounding rectangle or with `!yield`.
3. Triangulate this bounded local target using a shared constrained mesh. Existing apron edge/host constraints must be retained, and the outer contour is fixed. Reuse the bounded clipping/retriangulation work already being validated; do not add an unbounded adaptive refinement loop. Any new top-face grade, continuity, quantization, collapse or ownership failure remains a failed proposal. The outer boundary cannot be declared continuous merely because its vertices sampled the old ground: sample segments and actual route crossings as well.
4. Keep the original full/lite lattice vertices, indices and mask input arrays intact. Remove the **funicular** whole-vertex cap from their generation. At final render assembly, clip the existing painted base triangles beneath the patch's exact polygon and insert the canonical patch top. Uncut outside triangles remain bit-identical. For clipped triangles, preserve their original 3D plane and interpolate original color/UV attributes barycentrically. This removes buried native terrain without lowering adjacent lattice vertices.
5. The native coarse meshes need not have the same height along the new boundary. Do not assume that they do. If a visible seam requires a seal, use narrowly typed vertical/downward seam faces along that exact boundary to meet each tier's retained edge; these must never become upward floor candidates. Record their triangles separately and test actual outer-boundary continuity against the unchanged analytic floor in both tiers. Do not stretch a tier-specific sloped top apron outside the common patch, because that recreates different full/lite floors. If the measured edge cannot be joined within existing grade/step constraints, stop with that exact boundary witness.

## Physical query integration

In `regions/mountainV2/geography.ts`, preserve the original baseline ground/road/yield functions separately from the patch. The new `feltGround` uses `patch.floorAt` only inside its exact polygon and otherwise returns the existing baseline. Its scalar height must participate in the existing highest reachable floor merge with native road, branches, plank and Horizon solids.

Height alone is insufficient: `highestDrawnFloor` currently obtains a terrain normal from the height callback. When the selected result is terrain inside the patch, return the canonical triangle normal/slope from `floorAt`. Keep native deck normals and the road's exact triangle query unchanged. `groundAt`, `provider.ground`, the terrain result from `surface`, camera ground tests and art hosts then agree on one physical top.

Do not use the render tier to choose physics. Do not return a patch outside `contains`, through an excluded mouth, over an existing upper deck, or during the wrong scene generation. Existing ground ownership remains available while a region rebuild is hidden, as it does today; movement readiness and deck/contact gating remain unchanged. No hidden new plank/deck support is added.

## Drawing, paint and caches

Preserve `PreparedGround.lattice` and its masks as the original native grid. Add a final render-geometry result or a patch assembly step; do not append collar or clipping vertices to the lattice before `groundMasks`. Its `cols`, `rows`, `xs`, `zs` and global cache assume the original structured layout.

Make `groundMasks(L, tier, height, cache = maskCache)` take an optional cache, and use `cache` for both lookup and publication. Native callers continue omitting it. A Horizon generation supplies its own cache and cannot read or overwrite the native global cache. The old generation's cache is released during the existing scene invalidation; a new height callback cannot inherit old masks merely because its tier matches.

The patch retains the native `MeshStandardMaterial`, paper texture, flat shading, palette and UV convention. For its new vertices, reuse native ground painting through a private source lattice/mask set and interpolate that paint onto the canonical mesh. The private height input can include the new patch, but only its resulting local patch colors are consumed: the retained outside geometry keeps its original base colors. The existing global per-tier masks must never be used with the patch's unrelated vertex count/order. Recoloring on a theme change must update the assembled render attributes, rather than assuming every render vertex indexes the original lattice.

Prefer merging into the existing region ground mesh to avoid another draw call. If keeping a separate owned mesh is substantially safer, expose it explicitly to budget/render proof and dispose it exactly once; do not count it out of the region budget.

## Path-art ownership

Current AABB selection reprojects whole bands and stones that only touch `repairBounds`. That is too broad if the new common physical mesh owns only the exact patch polygon. Otherwise art outside the new common surface is projected onto an unchanged tier lattice and can again disagree with the analytic floor.

Use one of two explicit narrow policies:

- Make the finite common patch polygon include the complete footprint of every selected ribbon band and stone, freeze that exact selected primitive list, and prove the polygon covers them; do not repeatedly grow a box until it captures the whole neighboring path.
- Preferably split a straddling original ribbon at the exact patch boundary. Emit its outside piece on the original native triangle plane with original color/UVs, and project only the inside piece onto the canonical patch/actual upper hosts. The existing `split`, `intersect` and `subtract` helpers already provide this operation. Entirely outside native quads and boxes retain their existing primitive calls unchanged. A straddling stone needs an explicit supported footprint decision; do not lift every distant stone.

Feed the canonical patch triangles into the art host list and omit the removed old ground faces beneath it. Query and draw the original native plank from the existing shared helper, not from reconstructed metadata. Keep 40–50mm authored paint height and the existing 35–60mm acceptance window unchanged.

## Runtime generation and tests

Extend the already-proposed `refreshWalkingJoinSolids` generation to build and publish the patch, ground query and render preparation together. A late apron must synchronously invalidate/dispose the old scene, clear its private prepared ground/mask caches and publish the next consistent generation. Retained provider objects must forward into it. If patch generation becomes an asynchronous build step, retain the old consistent generation while hidden and publish the new one atomically; never expose new support while keeping the old picture visible. Native/default callers without a join keep their original path.

Add targeted tests/proofs, using the final accepted apron rather than v12:

1. A pure two-tier fixture where coarse native faces overshoot a narrow cap demonstrates the old defect. Both assembled tiers then use byte-identical canonical patch top positions/indices, and all tested floor heights and normals match those triangles. Native arrays and uncut outside triangles/attributes remain identical.
2. Private mask cache: same tier with different height/lattice callbacks produces independent masks for two Horizon generations; a later default/native request still receives the unchanged original native cache. Different theme recolors preserve the geometry and update every assembled vertex color.
3. Exact ownership: points just inside/outside each collar edge, `yield` overlaps, native plank fringe, protected road edge, and any exclusion boundary. No floor claim in a bounding-box corner outside the polygon, no displaced road/plank, no new upper deck or water obstruction.
4. Actual serialized/Float32 top-face normals and non-collapse; complete full-width paths and boundary connectors; no newly steep/slipped face or raised lip. Query-height and exact drawn-height comparisons are both retained.
5. Local art: 228 unchanged default/selected primitive cases still pass; outside retained art uses its original geometry plane; every changed art sample lies above the same canonical patch/upper host in both tiers. Retain the current epsilon-edge query witnesses separately—do not hide them by changing runtime tolerances.
6. Update and run the streaming diagnostic against the final asset and actual final mesh inventory, then full/lite seated captures. Final native/route/budget/device gates remain separate.

This is a localized geometry/ownership correction, not a one-line query patch. Writing a broad unproved implementation while topology is changing would be unsafe. The API and consumer boundaries above are intended to let root or the geometry owner implement one coherent version without changing native defaults or acceptance rules.
