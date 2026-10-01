# v15 — source fixture candidate, not yet accepted

Inherits the frozen v14 funicular-only1µm reconciliation and continuous-ground footprint with exact higher-host subtraction. Main Foot and native default behavior remain unchanged. The only additional change is a bounded interior vertex-star retriangulation fallback when convex pair flips cannot remove a runtime-invisible face.

A star must form one closed manifold ring of at most12 faces; the removed interior knot cannot belong to the fixed plank/capsule boundary. At most2,000 deterministic ear-clipping visits are allowed. Every replacement triangle must have positive plan determinant at least1e-8 and grade at most40degrees. Existing outer polygon vertices, perimeter and plan coverage remain. Paired reverse bottom triangles are rebuilt with identical connectivity; external wall indices remain. If no valid triangulation exists, construction still throws. The removed knot's interior surface displacement is not assumed zero and needs independent before/after overlay measurement.

Run only by root, in an unused output directory:

    node /tmp/mountain-funicular-v15/shape.mjs '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' /tmp/mountain-funicular-v15-shape

The source fixture regenerates YearWalk/S1/main Foot and uses ownership-aware ground. Shape saves all weld moves, flips/star records, exact geometry, runtime face threshold, closure, strict grades, actual plank overlap and prior20 witness neighborhoods. Passing shape is not full walking/art/baked acceptance. Art, streaming and performance proposals remain separate; this package has not silently adopted them. The shared sourceEnvironment helper is prepared separately and must be used by final bake and fixture before integrated proof.
