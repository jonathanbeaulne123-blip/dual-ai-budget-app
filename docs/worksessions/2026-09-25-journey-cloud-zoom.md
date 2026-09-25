# Harbour ↔ Journey cloud zoom — 2026-09-25

## Scope and risk

Branch `codex/seamless-journey-zoom` starts at `origin/main@8aba0e7c`. Risk **Medium-High**: App navigation and both world cameras change, while money, identity, ledger state, commands, sync, Auth and Final Confirm do not. Budget (5): **0**. Engagement (3): **+2 intended** from a continuous two-way zoom passage.

The outward camera gesture crosses the existing far radius once and carries Look to that radius as clouds cover the route. The current Chapter's closest Journey zoom starts the same passage in reverse. The existing route and history functions remain the only navigation writers. The destination reports scene readiness before the clouds clear; a flat or failed renderer reports its ordinary fallback. A 15-second guard releases the overlay if no destination can report. Reduced motion cuts the passage. Classic has warm paper light, Taylor a scrapbook tint, and Newfoundland marine fog. No saved setting or financial data is introduced.

## Evidence on this checkout

- TypeScript `--noEmit`: passed.
- Focused mountain camera and Harbour Journey: **50/50 passed**.
- Journey cloud lifecycle: **2/2 passed**, both directions wait for destination readiness.
- Journey game-mode explicit Harbour route: **1/1 passed** after the direct-world startup change.
- Journey mini and game-mode sweep before the last readiness-frame adjustment: **27/27 passed**.
- Vite web bundle: passed (existing PGlite/browser externalization and large-chunk warnings).
- The broad `harbour-open-world` suite has three terrain/pathfinding failures. The same three failures reproduced on the separate clean `codex/skate-air-grind-assist` checkout; the zoom case itself passed. This branch does not change terrain or pathfinding.
- The required Medium-High quick gate passed diff-check, AI-surface and TypeScript, then selected **83 tests** (74 fast, 9 serial). It failed in the fast phase, which includes the three unchanged `harbour-open-world` failures above; the serial phase did not run. The run exceeded its five-minute time budget. This is a **red gate**, not a release pass. Its change fingerprint was taken before the final direct-route focus adjustment, so it is not an exact final-tree gate.
- After that adjustment, the direct Harbour-route focus case and both cloud-readiness cases passed together (**3/3**). The initial full-world route now focuses its Minimize control when it mounts.

Actual browser passage, phone pinch feel, three-theme visual review and physical-device reduced-motion behavior remain **open**. No Development deployment, Production change or live acceptance is claimed.
