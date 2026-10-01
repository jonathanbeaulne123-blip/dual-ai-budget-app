# Independent Foot source review — fixture finding closed

Status: **P2 fixed; no remaining actionable finding in this bounded source review.**

The original fixture removed only the unsuffixed `mountainV2.footLane.apron` ID. World partitioning always appends `@district`, so a post-bake fixture could retain an old apron beneath the regenerated candidate and mask geometry regressions.

Verified from current source:

- `test/horizon-foot-lane-apron.test.ts:16–22` derives the logical identity from `sourceId`, falling back to the ID before `@`, and removes every served apron partition.
- Lines23–24 clear the old apron structure reference before rebuilding. The world serializer retains logical bed structure IDs (`world/build.ts:129`), so this exact logical-ID removal is appropriate.
- Lines18 and41–42 apply the same logical identity to regenerated Year Walk/S1 meshes, including prior `.footJoin` partitions.
- Lines47 and92 apply matching identity rules to the unrelated-geometry preservation comparison.

The prior read-only pass found no additional concrete regression in upward-face selection, native-footprint subtraction, outward bottom/perimeter winding, seam sealing, or source consumption. The bake calls the join after final corridors and before world partition/Lite preparation; runtime drawing and collision consume those serialized meshes. Keeping remote prism meshes separate preserves their existing prism-LOD eligibility.

This recheck read source only. It did not import the world, execute tests, run a geometry/controller probe, bake, typecheck, or write the checkout. The new blend geometry and1m spacing candidate remain subject to the other agent/root's measured validation. This report does not grant geometry, performance, visual, or release acceptance.

## Reviewed snapshot

UTC: 2026-09-30T15:32:39.377774+00:00

HEAD: `df77030298d5ff960d2eeaa5eb62c8558008694b` with uncommitted work; hashes below identify the reviewed source.

- `test/horizon-foot-lane-apron.test.ts` — SHA256 `f5b12ce9461c464dc9961541536bd98501a909038839ba891a6e83cefb5c0e37`
- `src/harbour/horizon/land/mountainV2/footLaneJoin.ts` — SHA256 `7aa5cf74d9989312f9640374c914f626ad81b56023c079b37ee2b39b2a6291f3`
- `scripts/horizon/bake-entry.ts` — SHA256 `fcea967922eebd2dc35794becc63176b672325b7c221596de48593ff1cafc783`
- `src/harbour/horizon/world/districts.ts` — SHA256 `1b2ba82717243f74bc7d9b592cc8409dbb02f6e876e1d85e7715c840601bcc4b`
