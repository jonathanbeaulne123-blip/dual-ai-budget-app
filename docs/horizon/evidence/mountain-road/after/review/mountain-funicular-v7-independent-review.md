# v7 independent source review — actionable findings

Read `/tmp/mountain-funicular-v7/candidate.patch`, its frozen `source/` files and `run.mjs`, and current native plant-emission source. No imports, simulation, tests, geometry generation or GPU execution. v5 classification files remain unchanged. These are evidence/runner findings; no confirmed new physical defect is asserted before v7 execution.

## P2 — Impact inventory excludes paths affected only by the surrounding ground cut

`run.mjs:63–65` first requires the native path bounds to overlap the apron, then skips every sampled point where `topAt(apron)` is not finite. However `walkingJoinGround.ts:21–23` deliberately lowers physical ground outside the apron (up to1.5m), and the exact lattice cap lowers whole intersecting ground triangles, including their exterior portions. A nearby route can therefore change floor or drawn support without crossing a deck triangle and never appear in `footprintInventory.paths`. The claim that all52 path records were examined does not close this exclusion.

Correction: build the impact bounds from the actual changed full/lite lattice vertices/triangles plus physical ceiling extent; sample candidate paths in those bounds without requiring an apron top. Record `apron:null` separately. Compare old/new physical floor and old/new actual drawn-ground heights. Preserve original route plans and actual movement tests; this is an inventory correction, not permission to repair other native routes.

## P2 — Vegetation witnesses cannot attribute rendered-ground changes to this candidate

`run.mjs:72–77` records the new rendered ground only. Its `before` is a physical `surface()` query, which is not the pre-candidate rendered lattice. Native art origins intentionally sit below their support (tree−.25m, flower−.04m, tuft−.02m); a gap between a saved root/new ground and the old physical surface cannot distinguish old draw/query mismatch from new cap movement.

Correction: prepare old full/lite ground using the old region and an independent cache, then record `beforeDrawnGround`, `afterDrawnGround` and their exact difference at each retained root/support sample. Keep the exact source authoring records and root offsets already reproduced here. The flower seed consumption agrees with `plantArt.ts:139–145`. Shrub corner samples are conservative axis-aligned samples, not exact emitted vertices; retain that distinction when interpreting individual burial/hover witnesses.

## P2 — Re-running the proof against an already fitted bake can silently audit the old apron

`run.mjs:15–21` loads baked solids and calls `fitFunicularFootJoin` without removing/rejecting an existing logical apron. The fitter returns immediately if the exact logical ID exists; partitioned existing solids may instead coexist with the new logical mesh. `added=find(exactID)` can then select old geometry, while the bundle hash correctly describes new candidate source. The final `sourcePreserved` comparison alone does not prevent this stale-candidate result, and the runner only writes it as data.

Correction: before construction, either fail closed if any `(sourceId ?? id.split('@')[0])` equals `mountainV2.funicularFoot.apron`, or explicitly remove all such partitions and their structure references from both candidate and baseline copies and state that baseline lifecycle. For this frozen pre-integration proof, a fail-fast guard is smallest. This does not claim the current served bake already contains an old apron.
