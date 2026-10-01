# Orchard junction and b0 approach — unapplied measured proposal

This remains a proposed native change requiring written approval. The checkout is unchanged by this agent. Root has executed the source-overlay, support and ordinary movement proofs. All 12 local rides passed with zero restarts, contacts, collision frames or airborne frames. The native change still requires written approval; full-world acceptance remains a post-apply check.

## Proposed bounded change

Repair the real Orchard→main-road lip (−0.179 m at reverse/right+2, Horizon [1325.47,69.61,671.24]) using one exact clipped junction surface. Keep the complete main road, its bridges and guard geometry unchanged. Preserve the original Orchard route XY, width 6.4 m and normals. Match immutable main-road triangle heights exactly at every overlap, then lower and fair only the beginning of Orchard masonry bridge b0, retaining flat bridge cross-sections and the existing builder. Row26 onward remains unchanged. This is an existing bridge-height adjustment, not a new span or permission to change main-road bridge elevations.

Reviewable source patch: `/tmp/mountain-orchard-b0-approach.patch` (13 source/test files); staged source `/tmp/mountain-orchard-proposal/files`. These files are frozen for root's queued movement proof.

| Measurement | Result |
|---|---:|
| Replacement query mesh | 1,111 vertices; 2,121 triangles replacing 260 |
| Entire junction Y movement | −0.4507263 to +0.3051364 m |
| Existing b0 rows8–25 maximum lowering | 0.3618198 m; no bridge raises |
| New longitudinal gradient, all tested source directions across width | ≤11.999010% |
| Maximum fitted facet slope | 25.000000%; tiny transverse junction face, not a longitudinal-grade waiver |
| Native/Horizon triangle-centroid floor matches | 2,121/2,121 within 1 cm |
| Centroid floor/ceiling failures | 0 |
| Body contact centroids | 252, all outside centre ±2 m |
| Closest contact to Orchard centre | 2.7520274 m |
| Proposed slab above river minimum | 8.4755734 m (old 8.5810099 m) |
| Arch soffit above river minimum | 7.8309933 m, unchanged |
| Funicular underside over lane minimum | 5.7455379 m (old 5.3837181 m) |
| Full actual ground-lattice vertices lowered | 36; maximum 0.1921291 m |
| Lite actual ground-lattice vertices lowered | 18; maximum 0.1218052 m |

Visible b0 starts at source row8, even though support classification starts at row9. The first two arch groups (8→23 and23→37) use the revised deck start heights; their spring levels and the last arch37→48 remain unchanged. Existing 1.6 m slab thickness, width and bridge identity remain intact. The large 11.53 m deck-to-valley difference is the original masonry span, not proposed unsupported fill.

The local ground cut is necessary: 537 dense samples of raw ground intersected paint and 162 would reject the lowered queried deck, worst 0.2247359 m. The proposal caps both ground queries and actual rendered terrain triangles; it does not relax the burial rule. The independent ground proof computes intersection witnesses separately from the production clipper. Its fresh full/lite final-Awning scenery-root check passes unchanged. Full affected lattice bounds x13.75..22.5/z−104..−92; lite x14..22/z−102.882881..−90.918922. The scenery authoring field remains the original field so this cut does not cascade random planting changes.

## Source ownership and guard interpretation

`/tmp/mountain-orchard-virtual-proof/report.json` compares original and proposed actual source bundles. Main road, all main-road bridges/edges, every PATH_EDGE, full/lite planting plans, props and district/station solids are exactly unchanged. The resulting native and Horizon queried surfaces agree at all 2,121 triangle centroids. Static support queries intentionally use Orchard support ownership; the actual movement check must test runtime selection.

`/tmp/mountain-orchard-virtual-proof/contact-classification.json` retains all252 contacts, with exact original-band projection. None lies inside Orchard centre ±2 m; nearest is triangle1258 at native [14.5551029,15.7808713,−95.5405348], 2.7520274 m off centre, contacting the existing left parapet. Root independently also found no contacts inside main-road ±2, ±2.3 or ±3 m strips using actual main triangles. These are edge/guard occupancy witnesses, not grounds for removing guards. Infinity headroom appears as JSON null in the initial static report because JSON cannot represent Infinity; no finite headroom failure was found. The movement harness records Infinity explicitly as text.

## Ordinary control check and limits

Root-run command: `node /tmp/mountain-orchard-movement-proof.mjs '<checkout>' /tmp/mountain-orchard-movement-proof`.

This overlays the unapplied source, then attempts twelve actual skate-driver runs: native/Horizon, forward/reverse, source-normal offsets −2/0/+2 m. It covers source rows0–32, including the unchanged row26 transition, beginning0.5 m into the original main-road overlap. It uses the same ordinary push/brake/steer pursuit and one initial mount. There are no kicks, resets, coordinate writes, controller tuning or hidden retries. Bail/recovery/stall/route departure is retained; contact and airborne frames remain separate from endpoint completion. Finish uses current projection within0.5 m and <1 m lateral residual. All twelve attempts completed cleanly, covering 30.813–32.962 m source lines through the entire blend and unchanged row26 transition. Neither this harness nor static proof claims browser, GPU, streaming or human-rider acceptance. The source proposal is fixed; generation reproduction is running separately.

## Reproduction and review artifacts

The exact source snapshot SHA is86fe249963667423a4b9f8c5360f271f6ada0ef1a0bbe9a4a6a1ffb88387d91f. `/tmp/mountain-orchard-generation/` contains the saved input, clipping, conforming-mesh/flat-row solver, hash manifest, expected product JSON and portable runner. Run `python3 /tmp/mountain-orchard-generation/regenerate.py /tmp/mountain-orchard-reproduced` in an empty output directory. It requires exact parsed-JSON equality with the reviewed product; syntax is checked but the packaged rerun remains pending root's serial slot. Preserve this complete directory with review evidence so future regeneration is actionable.

Additional proof artifacts: `/tmp/mountain-orchard-b0-flat-support.json`, `/tmp/mountain-orchard-ground-proof.json`, `/tmp/mountain-orchard-ground-probe-all-scenery.txt`, `/tmp/mountain-orchard-virtual-proof/report.json`, and the independent ground witness helper/tests in the patch. Source-overlay checks are not a substitute for post-apply source bake, focused regressions and actual draw/controller checks.

The rejected fixed-b0 alternative and exact22.905803% endpoint lower bound remain in `/tmp/mountain-orchard-fixed-plan-alternative.md`. A bounded800-candidate modest tie-in screen found no usable≤12% approach with the same full width and fixed original bridge start; it is not a proof that every possible reroute is impossible. The current lower/fair existing-b0 proposal is the coherent option being tested. No new25% longitudinal grade has been accepted or hidden under D-MR17.

## Local review evidence

This folder contains the exact source patch, portable generation artifact, static source/ground/scenery proof, and all 12 local movement results. The approach covers 25.908 m in plan; the affected initial bridge portion is 17.936 m. It repairs the remaining 17.9 cm main-road lip while keeping the main road and its bridges fixed. The complete surface adjustment is −45.1 to +30.6 cm; the bridge is only lowered, by at most 36.2 cm. Original paths, trees and props remain exact. This is a proposal, not an applied change.

## Written choice and application

Jonathan approved on October1: **“Yes—apply the Orchard repair and verify both worlds.”** The bounded source patch has now been applied as D-MR22. The original proposal evidence is retained above; final regenerated-world proof remains separate.

Portable generation reproduction passes exact parsed-JSON equality:2,121 triangles,1,111 vertices,31.133 seconds. See `regeneration-proof.txt`. Local movement maximum line deviation is0.068986m and maximum speed4.32337m/s.
