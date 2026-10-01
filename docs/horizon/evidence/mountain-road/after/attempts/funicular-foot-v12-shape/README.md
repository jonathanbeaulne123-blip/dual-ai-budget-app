# Horizon funicular Foot join v12 — unexecuted candidate

This replaces v11's failed ten-pass source-triangle refinement with at most 100 improving, convex, interior diagonal flips. All vertices and the exact plan perimeter remain fixed. Station plank/capsule perimeter edges remain constrained, including internal edges. Each flipped top triangle's paired reverse bottom is changed together. The strict 40-degree face gate remains; inability to find an improving legal flip throws. Visible interior heights can change, and require measurement; this is not byte-equivalent geometry.

The unchanged native station's actual full-precision plank rectangle now supplies physical support only when the Horizon walking join is mounted. That exact rectangle is subtracted from the apron; capsule-only fill remains Horizon-owned. Native station dimensions, path coordinates, native defaults and runtime corridorRenderStatus diagnostic are preserved. Existing approved Orchard and scenery/frame edits remain in the checkout and are not replaced by this proposal.

Files are frozen under source/. shadow-map.json defines the exact virtual source set. candidate.patch applies against the current checkout (read-only apply check passed). All 11 TypeScript source files passed parsing only; no typecheck/runtime/controller/ground/art proof has run for v12.

Root-only shape command, in a fresh unused output directory:

    node /tmp/mountain-funicular-v12/shape.mjs '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' /tmp/mountain-funicular-v12-shape

The runner snapshots source hashes, the instrumented source and exact bundle; saves before/after triangulation, every flip, strict top grades, closure, minimum altitude, sampled field error and actual plank overlap area. It saves a failed final mesh where construction reaches triangulation, and exits nonzero on a failed shape gate. It does not assert controller/art/ground acceptance. Field error samples are vertices, edge midpoints and centroids, not an exact supremum. Exact cumulative before/after interior displacement can be evaluated independently from the saved meshes.

If shape passes, the separately prepared full proof must be refreshed to this exact source set and run: 14 walking attempts, 26 continuous-width sweeps, both native paths' real art in six theme/tier variants, before/after contact/headroom, full/lite actual ground, scenery/path footprint inventory. Source and unconditional served-asset regressions plus final baked replay are pending. v8 through v11 failures remain preserved; no previous full-proof result applies to v12.
