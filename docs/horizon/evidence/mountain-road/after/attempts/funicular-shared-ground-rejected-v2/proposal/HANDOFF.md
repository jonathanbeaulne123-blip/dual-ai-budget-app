# Canonical walking ground v2 — unexecuted source proposal

The first candidate and `/tmp/mountain-funicular-shared-ground-proof-1` remain untouched. Root owns checkout, integration, bake, typecheck, geometry/controller and GPU runs.

## Changes from the first frozen candidate

`v2-only.patch` changes only `walkingGroundPatch.ts`, `ground.ts` and the focused test. It is based on the first frozen package; `BASE.json` records exact hashes. The combined overlay additionally copies root's current typed apron source and the separately proven exact cone index as dependencies. It does not edit their geometry or numerics. Current checkout groundPaint equals the first frozen optional-cache shadow byte for byte and is preserved.

1. **Bounded lower-only fairing.** A final face must have gradient no greater than max(its identically triangulated pre-cut baseline gradient, tan40°). Newly usable ground therefore stays ≤40°; an inherited steeper bank cannot worsen. Each violating face first chooses the smallest feasible one-vertex lowering that reaches that cone; a coordinated contraction toward the lowest vertex is the fallback. Shared neighbouring faces are rechecked. Maximum32 passes and3cm additional lowering per vertex are hard bounds; any failure is retained. No vertex is raised, and the unchanged outer-ring restoration guard stays active. Proof records every extra lowering and every remaining inherited steep face. This does not replace the actual path-width/controller40° gates.
2. **Perimeter-only adaptation.** The fixed rectangle and0.5m interior grid remain. Seven probes per boundary segment refine only perimeter cells when their analytical-boundary interpolation error exceeds5mm. Depth9 /2048 added vertices are hard limits. An independent complete perimeter scan at≤2cm spacing must remain within the root-requested2cm physical boundary bound. The method is explicitly a finite sampled approximation of the original nonlinear field; it does not claim exact analytical equality. No global Cartesian-grid refinement is added.
3. **Correct adaptive consumers.** `cellStarts` identifies the actual face range for each cell; queries no longer assume six indices per cell. The unchanged structured `paintLattice` receives existing road/path/river mask stamping. Every appended boundary/centre vertex has an explicit interpolation recipe from that stamped grid. Full/lite receive the same final canonical mesh and colours. The seam composer uses every actual adaptive boundary knot, not the old0.5m axes only.

The fixed rectangle still replaces the original local analytical field with common triangles; reducing its footprint further is not implemented. Outside source arrays/meshes remain unchanged. Any drawn coarse-grid seam or interior sampling issue remains observable and must pass the full proof. No claim that curtains alone establish walking continuity is made.

## Retained first-failure attribution

`first-failure-attribution.json` and its pure-JSON script reproduce:

-78 steep faces:67 coordinate-identical,10 improved,1 worsened. Thus77 were not worsened, but not all77 were identical.
-12 faces intersect published native path ribbons. Their intersected path area is wholly covered by higher saved apron/Horizon-host triangles; one facet's uncovered portion lies outside the ribbon. Native road/plank hosts were omitted from this conservative attribution.
-The worsened48.227903°→48.722695° face is entirely under the saved apron and outside the named path ribbons. It is still repaired; its location is not an exemption.
-44 saved boundary samples lie within a published native path half-width+0.3m, with maximum0.208mm delta. The global165.686mm witness lies far outside those paths and remains a failed first candidate.

This uses the failed first mesh, passed-v20 saved apron, and older v16 saved pre-join host meshes with explicit hashes. It is attribution evidence, not current support/controller acceptance or a claim about the fresh bake.

## Root-only serial commands after the active bake

```sh
FUNI_APRON_SOURCE='/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/mountainV2/footLaneJoin.ts' FUNI_CONE_SOURCE='/tmp/mountain-funicular-cone-index/walkingJoinGround.ts' node /tmp/mountain-funicular-shared-ground-v2/run-ground.mjs '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' /tmp/mountain-funicular-shared-ground-proof-2
```

Fresh output required. The diagnostic fixture now returns after source fitting with pre-join geography only. The runner then builds the actual final `createRegionGeography({walkingJoinSolids})` once, records `regionBuildMs` separately (including a failed constructor's elapsed time), and excludes offline source fitting. The final region is the one used by all proof queries. This measures post-fixture/warmed module state, not an unloaded-device cold start.

If preflight passes, the complete runner includes the modes agent's reviewed acceptance changes:

```sh
FUNI_APRON_SOURCE='/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book/src/harbour/horizon/land/mountainV2/footLaneJoin.ts' FUNI_CONE_SOURCE='/tmp/mountain-funicular-cone-index/walkingJoinGround.ts' node /tmp/mountain-funicular-shared-ground-v2/run.mjs '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' /tmp/mountain-funicular-shared-ground-full-proof-2
```

The14 walks,26 sweeps, six art variants, body-safe town widths, actual cross-boundary queries, exact inherited-post classification, unsupported art/stone failures and6cm drawn-seam gate remain explicit. Any conflict with the unchanged coarse render boundary is a failure to inspect, not grounds to hide geometry or broaden a tolerance. Both runners freeze the actual selected source/assets and reject drift.

## Verification status

Both runner files passed syntax-only parsing before packaging; no TypeScript source import, test, geometry generation, world/runtime or browser/GPU execution was performed by this agent. The pure saved-JSON attribution took under one second. Six focused source tests are drafted, including the added adaptive-cell query / stamped-paint completeness regression, and await root's run.

Next required: measured fairing/dimensions/triangles, physical and drawn boundary results, isolated construction cost, full usable-width/controller/art proof, configured typecheck, fresh-bake identity, real streaming lifecycle, and rendering/budget/device acceptance. This proposal does not change protected native geometry or controller limits.
