# Independent bounded source review: portable corridor batching

2026-10-01, current Mountain worktree. Reviewer did not author batching code. No checkout edits, imports, tests, browser or benchmark execution.

## P1 found and source-fixed

`runtime/corridorArt.ts` originally made packedLamp's compiler dynamically call `lamp.onBeforeCompile`. `runtime/index.ts:271` fog-hooks every exposed material, including both lamp and packedLamp. Packed compilation therefore nested both fog wrappers and declared `uHorizonFade` and `uHorizonFogCap` twice. The isolated GPU harness omitted runtime fog and could not detect this.

Current source captures `const lampCompile=lamp.onBeforeCompile` before exposing the two materials and calls that captured kit stage. This closes the source-level failure. `/tmp/mountain-packed-lamp-fog-test.patch` supplies a regression using the exact extracted runtime fog function, all actual corridor materials in mount order, and all three themes/two tiers. Root must execute the regression; no run is claimed here.

## Bounded remainder

No second concrete P1/P2 was established in the reviewed transform, wind, color, normal, depth, material, bounds or disposal paths:

- Installed Three transform/normal/color chunks are adapted without defining renderer instancing. Active indices reference only initialized record matrices; prototype coordinates and UVs stay local.
- Tree trunk flags, instance/trunk colors and per-archetype wind amplitudes remain available to the packed body shader. Shrubs and hedges receive a zero trunk flag. Unsupported stretch/rim/palm variants remain in their existing layers.
- Packed opaque bodies retain the prior Standard material appearance and matching depth hook. The existing shadowless six/two point-light pool is unchanged; the sun uses the supplied custom depth materials.
- The bound union retains every logical source instance bound. Season replacement and disposal release the packed geometry independently of the original prototype/record meshes.
- Counters and active records use submitted index ranges. Group bounds can submit offscreen source layers together with a visible layer, increasing submitted triangles while preserving the clipped image.

## Evidence and contract limits

Root reported an isolated real-WebGL Lakeside peak of 12 calls after packing (furniture6/plants4/shared-road2), compared with 19 before, with no GL errors. The measurement omitted runtime fog and shadow passes; that finite smoke is not a whole-world/device/timing acceptance claim.

ROAD.md:106 literally specifies instancing per archetype. The submitted packed objects are ordinary indexed Meshes, with repeated prototype vertices and per-vertex mat4 attributes. Authored records and shader-local transforms are preserved, but GPU instancing and its storage cost are not unchanged. This tradeoff should be explicit in the implementation decision. Memory and upload work scale with vertices times total capacity, and updates copy active instance attributes to each prototype vertex. Draw-call savings alone do not establish reduced frame time or lower memory use.
