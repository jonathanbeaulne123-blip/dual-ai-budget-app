# Corridor material batching: bounded source study

Read-only study, September 30. Checkout head `df77030298d5ff960d2eeaa5eb62c8558008694b`. No checkout edits, world imports, geometry generation, renderer, bake or heavy test. The existing `/tmp/mountain-light-gap/candidate-budgets.json` is the pre-pruning candidate; its world hash starts `63c4d1e47b6205c6`. These figures are not the upcoming final bake. Exact inputs/source hashes and theme-specific counts are retained in `/tmp/mountain-corridor-batching-study.json`.

No small portable optimization was found that meets the combined draw limit while retaining the current per-archetype rendering contract. A bounded lamp/post prototype batch is technically supported by installed Three 0.185.1, but its draw reduction requires a live renderer capability and it cannot close full Lakeside alone. No source patch is proposed as an acceptance fix.

## Current evidence and lower bound

| Candidate district | Full, every theme: furniture + plants + shared night | Lite Classic/Taylor | Lite Newfoundland |
|---|---:|---:|---:|
| Lakeside | 8 + 9 + 2 = 19 | 8 + 6 + 2 = 16 | 8 + 6 + 2 = 16 |
| Prow | 5 + 6 + 2 = 13 | 5 + 4 + 2 = 11 | 4 + 4 + 2 = 10 |
| Crown | 7 + 4 + 2 = 13 | 7 + 3 + 2 = 12 | 7 + 3 + 2 = 12 |
| Hollow | 5 + 6 + 2 = 13 | 5 + 4 + 2 = 11 | 4 + 4 + 2 = 10 |

The two night draws are one shared global pair, conservatively charged to each district here; they are not additive across districts. The supplied plant counts are resident capacity/component upper bounds, not a measured simultaneous camera peak. ROAD §8's limit remains 12 draws; no threshold change is suggested.

There are at most five body archetypes in the existing furniture loop: four lamp kinds and railPost. Combining all eligible body kinds can therefore remove at most 4 draws. Even that optimistic bound leaves full Lakeside at least 15 including the shared night charge. Actual savings are K−1 for the K body kinds present, not 4 everywhere. Removing fixtures reduces triangle/instance counts, but changes the number of body draws only if it removes an entire local kind.

## Why birch/round cannot simply share the existing instance bucket

`runtime/corridorPlanting.ts:160–164` already shares the same 0.022-wind body/depth/shell materials between birch and round. Their geometries remain different: `mountain/art/plantArt.ts:31` builds tall asymmetric birch lobes, while `:35` builds the round crown; `kit/plants/geometry.ts:393` also derives the species' trunk size and crown gradient. Reusing one geometry in the other's bucket would change authored silhouettes/paint.

A naive BatchedMesh replacement is also incorrect. `kit/plants/materials.ts:43–67` reads `USE_INSTANCING`, `instanceMatrix`, aFar, aBorn, aPart/aTrunk and instanceColor for wind phase, distance fade, residency growth and separate trunk colour. `runtime/corridorPlanting.ts:225–246` allocates and compacts those per-instance attributes each time the resident set changes. BatchedMesh uses `USE_BATCHING` and texture-backed instance transforms; it does not transparently carry those custom attributes. The existing shader would take its non-instanced branch (`ph=0`, `fd=1`) and lose the intended wind phase/fade behavior, while two-tone colouring and attributes also require adaptation. Matching the depth pass, full ink shell, seasons and item probes makes this larger than a small bucket regrouping. No tree, shell, species or lite shape is removed or simplified here.

## Bounded lamp/post option

Lamp/post bodies are the safer candidate: `runtime/corridorArt.ts:88–95` supplies one shared lamp material for all kinds, with the existing per-vertex aGlow flag controlling day/night glass; `:224–228` creates their per-kind InstancedMesh objects. Every prototype has compatible position, normal, colour, UV and aGlow attributes. Their transforms are ordinary translation/yaw/positive height scaling. Ink, contact shade, markings and shared night cards remain separate existing batches.

Installed `three/src/objects/BatchedMesh.js:158–175` explicitly supports adding each geometry once and then multiple instances referring to that geometry. It preserves prototype reuse and separate transform matrices; it need not duplicate the fully transformed geometry for each lamp. The installed standard shader handles batching position/normal transforms, so the existing lamp shader can retain its material parameters, paper UVs, glass flag and night uniform.

This is **multi-draw prototype reuse**, not the current `drawArraysInstanced` call per archetype. `three/src/renderers/WebGLRenderer.js:1303–1321` uses WEBGL_multi_draw when available; without it, it loops and issues a separate draw for each visible instance. `WebGLBufferRenderer.js:29–43` counts the supported multi-draw submission as one renderer call, while preserving the summed submitted triangle count. An audit must not silently equate either backend or claim a device-independent reduction.

The smallest coherent implementation choice, if pursued, is:

1. In `runtime/index.ts` pass actual `renderer.extensions.has('WEBGL_multi_draw')` capability to corridorArt. Default false for headless fixtures and unsupported devices; retain the current per-kind InstancedMesh fallback.
2. For a district with at least two eligible kinds, build one BatchedMesh with one geometry ID per unchanged archetype, addInstance per existing Piece, and copy its original matrix. Keep all original material/shadow properties, the district's residency and lazy disposal, existing detail/ink/shade batches, lamp head anchors and shared night systems.
3. Update `corridorArt.ts:230–231` statistics to sum prototype triangles multiplied by instance counts for the batch. Its current non-InstancedMesh branch would otherwise count only the unique prototype buffer and under-report triangles. Keep unsupported-device counts as the current fallback numbers. Do not grant a one-draw claim to a headless run lacking that capability evidence.
4. Verify prototype attribute arrays and instance matrices against the old builder across every theme/tier; verify disposal/rebuild and unchanged head anchors. Then use the real renderer to check day/night material, normals/shadows and actual render-call counts with both backend paths. These checks have not run in this study.

This option needs no large framework and keeps prototype reuse. It is conditional evidence only, and whether multi-draw prototype reuse satisfies ROAD's exact per-archetype wording should be stated explicitly rather than assumed. There is no demonstrated portable pass for the inherited full Lakeside total. Retain that limitation in the final gate; closing it requires a separately scoped rendering change or an explicit product/budget decision, not a hidden STYLE exception.
