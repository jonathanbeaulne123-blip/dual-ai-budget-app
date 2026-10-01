# Final Foot source proposal: corrected one-metre mesh

Root integration delta: `/tmp/mountain-foot-final-one-metre.patch`. It changes only `src/harbour/horizon/land/mountainV2/footLaneJoin.ts` and `test/horizon-foot-lane-apron.test.ts`, preserving root's logical-source-ID fixture repair. Apply-check passed. Agent did not write the checkout.

Source SHA256: `9ab29105d786870d3a81f052d9f33b11b0ee5d334c8fdee04cf82b28cffde4f7`.
Patch SHA256: `ceeef4e7d04a6b6c61427d7ec70d33bbfb57bef950d56cd8c7448097101062fe`.
Full machine-readable package: `/tmp/mountain-foot-one-metre-final-proof.json`.

## Source changes

- Use one-metre source tessellation for both rendering and collision. The physical apron remains the existing seven-metre Foot route footprint; route points/native Mountain source do not move.
- Keep full target height for two cell lengths beyond the usable lateral and longitudinal limits before the one-metre feather. Two cell lengths conservatively bound a fitted cell's diagonal. This prevents raised outside vertices tilting a triangle into the road. At STEP1 the adjacent source shoulder treatment extends farther than STEP0.5; the visual comparison below is explicitly limited to the usable road band.
- Extend the actual V03 boundary continuously at an eight-percent descent limit, preserving its authored transverse height. The old per-point host-hit/fallback created a discontinuity where the final V03 triangle ended. Combine this lower envelope with the lane profile, then cap it by the actual native-edge upper envelope.
- Apply the native-edge ceiling after the final source blend and to every inserted clipping knot, including intersections on extended triangle lines outside the native footprint. Those interpolated knots caused the measured51–89degree slivers.
- Retain the applied exact native-footprint subtraction and sealed topology. Native road remains highest in overlap; every local mesh uses the same visible/physical triangles. No controller or collision-query tolerance changes.

## Selected one-metre result

7,972local source triangles versus20,712in the corrected half-metre comparison. The actual district full/lite budget still requires the bake; this is not a district budget pass.

Fourteen Foot sweeps at0.04m longitudinal spacing, centre and±2/±2.625/±3.4m in both directions: zero contacts, native intrusions,0.06mcontinuity failures, index incidence/winding failures or bottom burial failures. Maximum successive height change1.661cm. The original named native-ownership point remains native-owned.

Every one of3,044local upward triangles was examined at its centroid and three80/10/10interior barycentric points against the actual composed highest floor.5,670samples were exposed in the road/native-edge scope. Highest exposed road face10.7673%, below12%. The nearby native-edge shoulder maximum12.1600% lies outside the seven-metre Foot road band and is only6.933degrees. Maximum of all local upward faces, including off-road shoulders,37.553degrees, below the40degree walking limit. This is a complete source-face enumeration with sampled exposure classification, not an analytic polygon-occlusion proof.

The V03lower/nativeupper envelope comparison sampled8,033positions across the full seven-metre lane at0.08mstation/0.25mcross spacing. Minimum upper-minus-lower clearance is+0.649777m, so the sampled usable lane has no incompatible height requirements.

Compared with the corrected half-metre mesh, maximum sampled highest-floor difference within the usable seven-metre band is+1.196cm. This is not a global visual-difference bound: the cell-diagonal buffer changes the outer shoulder blend reach by one metre. The half-metre variant is rejected because a new exposed off-road shoulder reaches41.816degrees; its successful centre-lane checks alone are insufficient.

All four independent actual-controller attempts completed the22.014mFoot reach, with0.5minitial/end margins, ordinary inputs, zero contacts/bails/airborne/off-bed frames/restarts:

| Mode | Direction | Reported progress / attempted | Time |
|---|---|---:|---:|
| Bicycle | Forward |21.0605/21.5140m|6.750s|
| Bicycle | Reverse |21.0304/21.5140m|7.717s|
| Walking | Forward |21.0402/21.5140m|8.767s|
| Walking | Reverse |21.0402/21.5140m|8.767s|

The bicycle uses the existing general pursuit driver. Walking extracts the real runtime move function with gateOpen=true. These are separate short Foot attempts, not a full-chain, V03corner, native-skate or live-device pass.

## Regression and proof files

The test delta retains0.06mcontinuity/native-ownership tolerances, adds the exposed sliver witnesses, scans actual upward faces, checks12%exposed road grade and40degree local walkable faces, and retains the previously added manifold/burial checks. Root's fixture removes old served `@district` chunks before source regeneration and preserves logical source identity.

- `/tmp/mountain-foot-capped-one-proof.json`: geometry/dense sweeps/half-grid comparison.
- `/tmp/mountain-foot-capped-one-modes/face-grades.json`: source-face exposure scan.
- `/tmp/mountain-foot-capped-one-modes/results.json`: actual short-controller traces and hashes.
- `/tmp/mountain-foot-envelope-compatibility.json`: boundary envelope compatibility.
- `/tmp/foot-capped-compare.mjs`, `/tmp/mountain-native-branch-audit/foot-capped-one-modes.mjs`: repeatable scratch runners.

## Retained failures and limits

Original source gaps, false fixture retention, initial mesh nonmanifoldness and bottom-clamp failure remain recorded in earlier reports. `/tmp/mountain-foot-one-metre-integrated-witness.json` retains the first88.89degree one-metre sliver. Both grid sizes' subsequent failures remain under `/tmp/mountain-foot-blend-only-*`, `/tmp/mountain-foot-unbuffered-*`, `/tmp/mountain-foot-buffer-only-*`, and matching `/tmp/footLaneJoin-*`sources. The final corrected half-metre comparator retains its41.816degree shoulder failure in `/tmp/mountain-foot-capped-half-proof.json`.

The candidate is source-only until root applies/tests/bakes. Geometry probes reconstruct selected source emitters in current baked surroundings; final partition, full/lite budgets, whole-road both-direction drives, neighboring footway traversals, streaming/gates, art/device/camera acceptance remain separate. Earlier V03offset-frame discontinuities and failed whole-route attempts were not removed or reclassified.
