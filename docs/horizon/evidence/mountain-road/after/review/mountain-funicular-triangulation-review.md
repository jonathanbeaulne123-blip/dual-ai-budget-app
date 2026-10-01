# Bounded Funicular triangulation review

Read-only source and saved-JSON arithmetic; no world imports, generation, browser, tests, or checkout changes. Source reviewed: `/tmp/mountain-funicular-v11-shape/instrumented-source.ts`, the v10b source/mesh, v11 pass diagnostics, and the optional station plank ownership helper. The candidate is not applied.

## Diagnosis

The grade failure is real in the emitted mesh, but is not evidence that the fixed 40-degree allowance is too low. v10b face 7308 is 86.5401334483 degrees, with plan altitude 0.001704970926m over a 0.490034738m edge; its three edge grades are only 26.1441%, approximately zero, and 17.5930%. Shallow one-dimensional or sampled-field gradients do not bound the affine plane fitted to a nearly collinear triple.

`appendFill` (v11 lines 417-430) inserts nonlinear height/base roots and lifts those knots with `height`. `clipFootJoinToNative` lines 151-158 samples the nonlinear height field again after plan clipping, then triangulates the nonplanar polygon as a first-vertex fan. Its arbitrary diagonals can straddle active min/max height branches. The original triangle's planarity is not retained.

Longest-parent-edge refinement (v11 lines 468-479) addresses neither the clipped polygon's condition number nor the active-height switch. Captured passes demonstrate non-monotonic grade: 86.54, 51.91, 62.84, 54.60, 89.99965 degrees. Pass 4's worst triangle has only 31.2904nm plan altitude. The ten-pass limit correctly fails closed; raising it is not a robust fix.

## Bounded remedy supported by saved geometry

Use constrained convex interior edge flips on the final clipped top mesh. Keep all coordinates fixed; select only an edge with exactly two incident upward triangles and a strictly convex plan quadrilateral; require both replacement faces to retain upward winding and strictly improve the pair's maximum actual mesh grade. Preserve exact external/native/road boundaries and all internal station plank/capsule perimeter constraints. Keep the unchanged final 40-degree check and a finite operation budget. Failure must remain an error, with no face deletion, wider tolerance, or implicit refinement fallback.

Independent arithmetic applied the six recorded flips from `/tmp/mountain-funicular-flip-study.json` to the saved v10b solid. Both meshes have 6088 top faces; their exact boundary-edge sets are identical and each has zero nonmanifold top edges. Ten original triangles become ten final triangles. The final maximum grade is 38.3376493844 degrees and no top face exceeds 40 degrees.

The flips change real interior height despite preserving every vertex and boundary. Exact common-refinement comparison of original and final triangles finds maximum final change +0.039231287394m at Horizon x1285.827651862,z720.680967284, from y54.651542968 to54.690774255. This must be treated as a source geometry change and retained in proof.

Production integration must replace each changed top triangle's corresponding reversed bottom triangle using the same paired bottom vertices (or rebuild the closed shell). Shared top/bottom triangulation preserves the per-vertex minimum thickness throughout each face; retaining unmatched old bottom diagonals would lose that guarantee. External side walls should remain byte-identical. The saved study changes only top connectivity, so it does not itself prove this complete-shell contract.

The optional plank helper is relevant only as a fixed boundary constraint: the actual planked rectangle and circumscribed station-support capsule must keep their flat tops. A boundary edge with two incident triangles can still be physically constrained and must not be flipped merely because it is internal.

## Required follow-through

Fresh whole-face slope, closed-shell incidence/winding, minimum thickness, fixed-host edge/top preservation, ground exposure, native ownership and clearance checks remain required on the actual integrated candidate, followed by the already planned bounded controller/art runs. The six-flip saved mesh result is not runtime or full-route acceptance.
