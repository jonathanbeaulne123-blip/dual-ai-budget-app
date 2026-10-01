# Static face bounds candidate — source only, not accepted

Artifacts:
- `/tmp/mountain-face-bounds.patch`: candidate edit to runtime/geography.ts only.
- `/tmp/mountain-face-bounds/geography-before.ts` and `geography-candidate.ts`: exact frozen variants.
- `/tmp/mountain-face-bounds-parity.mjs`: root-only saved-v16 parity/CPU runner. Not executed here.

The proposal adds four Float64 numbers per indexed nondegenerate face: min/max XZ expanded conservatively. It rejects an impossible candidate before triangle(id) reconstructs its three vertices. Surface, ceiling, side contact and contact's underside pass all use the filter. It does not change CELL24, bucket entries, Set insertion order, last-equal-height surface ownership, first-contact ownership, normals, barycentric tests, height bands, travel tests, radii, dynamic providers, or original projection/intersection arithmetic. An actual hit still runs exactly the original code. Strict outside comparisons avoid an inverted `!inside` treatment of NaN.

Projection padding covers the original1e−6 barycentric fringe: each accepted barycentric coordinate can reach1+2e−6, so2e−6×maximum XZ span bounds its geometric AABB extension. A deliberately generous Float64 error allowance scales with world coordinate magnitude, face span and the24m bucket. Near-singular projected triangles use unbounded bounds rather than risk culling an old accepted result. Faces already rejected by the original |det|<1e−8 projection retain physical interpolation padding for contact. Radius contacts use the body radius rectangle against those padded bounds; underside tests use the point projection bounds. No epsilon in the physical tests changes.

**Resource tradeoff:**32 additional active bytes per indexed face, versus current20 bytes for owner/offset/normal. The saved v16 corpus has12,128 earlier source triangles +19,128 candidate triangles =31,256 raw faces: at most1,000,192 added active bytes (~0.954MiB), with1MiB bound-array allocation at32,768 capacity. Capacity still doubles with the existing arrays. `indexStats.referenceBytes` includes the new bounds so memory is not hidden. Full-world cost scales with all retained faces; this does not remove any geometry. Bounds assume immutable indexed XZ positions/indices, as do the existing bucket index and stored normals.

## Root command when the heavy lane is free

```sh
node /tmp/mountain-face-bounds-parity.mjs "$PWD" \
  /tmp/mountain-funicular-foot-candidate-proof-v16 \
  /tmp/mountain-face-bounds-observed
```

No bake or source fixture reconstruction: the runner loads `before-source-solids.json` + `candidate-solid.json` and the exact saved v16 terrain hash. It fails if the field/current baseline source differs, refuses output overwrite, freezes both source bundles, and preserves all exact-answer differences with nonzero exit.

Coverage: saved ordinary walking traces and failing sweep positions; distributed real face centroids and barycentric fringe points; local bucket grid; all exact surface/ceiling/contact fields; .65m/1.25m/1.4m bodies and travel directions; synthetic equal-height ownership, first-contact ordering, vertical and skinny triangles, CELL-edge coordinates, streamed additions and typed-array growth; unchanged dynamic-provider priority/removal. Original and candidate CPU timings alternate order after warm-up and use uninstrumented query code. Build times and resource statistics are separate. This is an exact finite parity corpus, not exhaustive floating-point or GPU proof.

Only after parity passes should root compare the real v16 movement/art workload elapsed time and preserved results. A fast query corpus does not justify claiming a full-run improvement; rejecting geometry is never a performance workaround. Neither the patch nor runner has been imported/executed by this agent.
