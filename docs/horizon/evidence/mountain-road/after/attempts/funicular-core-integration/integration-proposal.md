# Source-only integration composition

`callers-bake-tests.patch` is against the current root checkout, not frozen v16. `manifest.json` records every base and candidate SHA-256; complete candidate files are under `source/`. `git apply --check` passed; no tests, source/world imports, generation, browser, or heavy processes were run.

## Apply order

1. Root chooses the accepted shared-ground revision. Do not treat this caller package as ground acceptance.
2. Integrate shared-ground core from its shadow-map, except runtime/index.ts (the narrow runtime delta is included here). Its footLaneJoin.ts is byte-identical to `/tmp/mountain-funicular-v20-final/footLaneJoin.ts`; sourceEnvironment.ts is byte-identical to the separate source-environment proposal. Avoid duplicate application of either earlier patch.
3. Apply `callers-bake-tests.patch`. It contains 18 caller/test consumer files, bake-entry.ts, three runtime lifecycle hunks, current apron fixture composition, streaming regression, and the five draft pure shared-ground cases (23 distinct files total).

## Exact preservation

- Runtime changes only add walkingJoinSolids during placement, initial refresh after the placement/load race, and late-chunk refresh before static publication. Current corridorRenderStatus is retained.
- Modes audit changes only add walkingJoinSolids. Actual same-revision initial restoration, rejected relocation, initial-support and body-footprint telemetry remain byte-for-byte.
- No cards.ts, land/interfaces.ts, runtime/geography.ts, mountainV2/joins.ts, planning.ts, or beds.ts changes. Root's sourceOrigin/interface, static triangle bounds, and D24 Summit work remain untouched.
- Frozen v16 versus current region geography/ground/scene/index differences are the intended funicular additions. Its routeArt difference is the opt-in native path-art hook; native callers omit it. Use the pending shared-ground replacements for these files, not old cap-lattice variants.
- Current groundPaint.ts is the explicit base of the shared-ground optional private mask-cache injection. Do not replace it from an older native snapshot.

## API revisions included

- No added source retains capGroundLattice. Region scene mounting passes `walkingGroundPatch`; prepareRegionGround's sixth argument is that object.
- Road-ground regression samples `prepared.render.positions` and `prepared.render.indices`, the final clipped/canonical render mesh, not the original lattice/index.
- Streaming mock exports walkingGroundPatch and records it at scene mount; checks require undefined before join delivery and the new generation after refresh/cancellation.
- Existing apron fixture excludes both old main and walking apron source IDs (including served partitions), uses mountainSourceEnvironment before fitting, then builds its final provider with the fitted solids. It never feeds the new walking cut into its own construction.

## Do not blindly apply the larger stale test replacement

`/tmp/mountain-funicular-source-environment/regression.test.ts` was not copied wholesale. In addition to capGroundLattice -> walkingGroundPatch, its path-art mock needs `quad` for preserved native bands. Its all-box floor test includes unchanged outside stones now intentionally retained by canonical clipping; distinguish proof.preservedStones from repaired proof.stones, verify preserved output against native art, and test physical seating of repaired boxes only. No threshold change is appropriate. The current regression was retained here with only fixture corrections. The external v20/shared-ground movement/art runner still supplies the wider candidate proof until its permanent regression is updated.

## Remaining root validation

Shared-ground constructor/boundary decisions, revised pure test compatibility, configured compilation, focused tests, final bake, exact final-source movement/art proof, streaming lifecycle and GPU/budget captures remain root-owned. Source/applicability review is not acceptance of those gates.
