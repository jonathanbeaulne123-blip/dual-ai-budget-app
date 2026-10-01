# Independent final Foot apron review

Verdict: no concrete actionable source defect found in the applied one-metre candidate. This is a bounded source-only review, not independent execution of the reported five tests or movement traces.

Reviewed `/tmp/mountain-foot-final-one-metre.patch`, the full applied `src/harbour/horizon/land/mountainV2/footLaneJoin.ts`, `test/horizon-foot-lane-apron.test.ts`, the production bake call order, and the relevant bed/mesh/runtime contracts. Read the author report only to distinguish its claims and limits; its passing results are not independent evidence in this review. No checkout edits, builds, tests, browser, terrain imports, or movement probes were performed.

## Source assessment

- The native upper field (`footLaneJoin.ts:27-42`) analytically minimizes height plus 10% distance along every actual boundary segment. The sign and stationary-point formula are correct, including choosing the proper endpoint when a segment slope reaches/exceeds the cone slope. It uses source road transverse frames, not a parallel guessed centreline.
- The V03 lower extension (`:230-239`) correctly maximizes source height minus 8% distance along the actual emitted V03 triangle edges. At a disappearing host footprint boundary it includes that boundary height, so dropping the direct host lookup no longer forces a fallback-height jump. Including internal triangle edges is conservative: they are actual source points, though the extension is not a guarantee that arbitrary future V03 geometry will meet the native upper field.
- Combining the lower fields with the native upper field at `:251` is continuous for the current continuous lane and host inputs at the join. The cap is correctly applied after feathering (`:254`) and again to inserted polygon knots (`:154`), closing the previous gap where interpolated clipping points could remain proud.
- `STEP=1` with a two-cell full-height buffer and a one-metre feather (`:223-245`) covers a fitted cell diagonal of at most two metres before blending. This deliberately expands nearby Year Walk/S1 treatment beyond the seven-metre apron; it does not widen the apron itself or alter route XY. The source restricts replacement to intersecting source prisms of the named Year Walk/S1 surface families, preserves distant prisms separately, and leaves native source geometry untouched.
- The clipping pass subtracts the actual first-road swept triangle footprints. Newly introduced true-boundary knots lower below the native face by 5mm; non-boundary knots obey the continuous native approach cap. Polygon orientation is preserved. The closure pass merges only roundoff-equivalent XYZ points, reconciles buried bottoms, inserts collinear boundary knots, preserves the top plane when fanning, and splits distinct vertex fans. No collision tolerance is changed.
- The production call in `scripts/horizon/bake-entry.ts:36-39` occurs after corridor settlement, so V03's emitted host deck is available, and before world compaction/lite preparation, matching the prism-layout requirement. The fitter builds real walkable closed triangles and buries bottoms below supplied visible ground; it does not add an invisible support-query exception.

## Fixture independence

The fixture is meaningfully independent of the candidate's height formulas: it queries the actual composed geography, separately computes triangle normals/edge incidence, and uses the native runtime provider for ownership. It explicitly removes every previous apron partition and old fitted Year Walk/S1 source family, then regenerates source prisms before applying the candidate. `floorSource: originals` does not reintroduce the previous apron or fitted deck as a support floor: the emitter's floor-source helper accepts only walkable `role === 'floor'` solids with IDs ending `.slab`, whereas the apron/fitted pieces are decks. The actual emitted V03 source remains the host.

The continuity/native-ownership assertions remain unchanged. The new slope assertions inspect all upward faces for the 40-degree local walking bound, and selected exposure points for the 12% road bound. Topology assertions require both two-face incidence and cancelling orientation, rather than accepting open/nonmanifold surfaces.

## Explicit limits

- The source formulas do not themselves enforce a lower/upper compatibility invariant for changed future route geometry. A freshly baked-world check remains necessary. I did not independently reproduce the author's sampled positive envelope separation.
- The fixture's lane sweeps run centre/±2/±2.625m, omit the first/last 0.5m, and sample every 0.08m. The wider ±3.4m and full-context controller results in the author report are separate evidence, not rerun here.
- Four barycentric exposure samples per top triangle do not analytically prove every thin overlap with the full seven-metre road footprint. All-face 40-degree slope and topology checks are stronger than the sampled exposed-road classification; final actual route/edge traversal should remain part of acceptance.
- The fixture rebuilds selected local source emitters in baked surroundings. Its unchanged-geometry assertion compares its local input before/after; it does not independently prove every distant source prism against integrated main or final full/lite partitioning.
- No final source/asset parity, visible art, full/lite budgets, adjacent complete footway traversal, or device/control acceptance is claimed by this review.

## Reviewed hashes (SHA-256)

- `src/harbour/horizon/land/mountainV2/footLaneJoin.ts`: `9ab29105d786870d3a81f052d9f33b11b0ee5d334c8fdee04cf82b28cffde4f7` (matches frozen author candidate).
- `test/horizon-foot-lane-apron.test.ts`: `8c1599eab064ebb391164f402e65044818d6a6bcc6fa3318da38302db241743c`.
