# Prepared comparison — not run

Run after the serial baseline lane releases:

```
node /tmp/mountain-planting-compare.mjs \
  '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-baseline-proof' \
  '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' \
  /tmp/mountain-planting-comparison --execute
```

Outputs baseline/snapshot.json, current/snapshot.json, comparison.json and summary.json. Each child has a 180-second timeout and 1.5GB heap cap, runs serially, and exits before the other begins. No bake, browser, scene renderer, checkout writes or native edits.

Snapshots include exact full/lite planting and prop records, branch source payloads, actual branch art triangles, exact runtime branch support solids, authored tree mesh prototypes/transforms, related fixtures/pavilion columns/rock strata, checkout HEAD, and hashes of bundled source dependencies.

One measurement-only source transformation adds an optional branch ID to buildBranchArt and excludes the unrelated footbridge while capturing each branch. It changes no coordinates, profiles, colors, primitive implementations or selection inside a selected branch. The real CardBuilder and card kit emit the arrays; no finish/render/material build occurs. Tree meshes use the actual crownGeometry/trunkGeometry and exact transforms from plantArt.

Matching uses whole serialized records first, with duplicate-aware multiset correspondence. Indices are provenance only. Stable prop IDs, exact same XZ, and equal non-location attributes are separate categories; an attribute-only plant match does not establish identity or prove a move. Retained item order is checked explicitly.

Geometry checks are separate:

- Static rendered baseline crown/trunk triangles against newly emitted current branch triangles, using triangle SAT including coplanar axes; exact intersecting face witnesses are recorded. Unchanged branch faces do not become new landing conflicts.
- Actual runtime tree cylinders (.22*size radius; y..y+1.5*size) against current branch support AABBs; unchanged and changed support hits remain distinct.
- Shrubs, flowers and tufts use conservative envelopes for follow-up candidates only. They cannot authorize deletion.
- Full item changes carry nearest changed triangle-box distances, conservative lower bounds useful for proving distant/nonlocal drift. A small lower bound does not establish an authorized local change.

No automatic plant removal is produced. Every proposed removal must be tied to the approved landing band, preserve all unaffected records and order, and distinguish old conflicts from new geometry. The actual static tree test excludes wind, outlines, blossom/fruit attachments and fully-contained solids without a surface crossing; these limitations are retained in the JSON. The pending awning entry and native bend work are not approved by executing this diagnostic.

No exact baseline comparison, count, locality verdict or source-preservation repair is claimed before execution. The runner itself has not been executed or syntax-checked during the source-only freeze.
