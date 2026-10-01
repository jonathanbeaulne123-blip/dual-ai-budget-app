# Observed shade fallback

One actual SwiftShader pose, frozen intermediate world/terrain and old/new bundles. Both images are pixel-identical. The current callback reports near-plane fallback:840 source triangles,48 back-facing,164 front-facing,612 wholly near-clipped and16 uncertain at the near plane. Shade remains two calls/1680 submitted triangles. This is the measured reason for the proposed conservative per-triangle partition; the optimization itself remains unverified. This isolated first-residency pose totals10366 triangles; the full sweep retains its10406 peak.
