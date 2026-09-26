# Horizon land repairs and Claude handoff

Status: repair candidate and handoff delivered; **NO-GO for PIN-1 or release**. Jonathan owns approval. Builder: Codex. Independent land reviewer and enhancement owner: Claude.

Baseline: `0f601b55054fbc55ca997b172f4a1e9daf0ce79d` (merged #548), verified against GitHub before work. Branch: `codex/horizon-land-repairs`. Tested code: `6dd7aacf1bbb3c9dae71f7e9e496455aa660b7cb`, clean during the final gate/build/captures. The subsequent handoff commit changes documentation only. Risk High. Budget delta (5): 0; ledger, Auth, household, schema and Final Confirm boundaries retained. Engagement delta (3): seven physically accessible host routes and improved land/view continuity; wider land acceptance remains open.

Jonathan requested fixes and a packet for Claude to review and enhance. Full scale 1.0; three uphill Terraces plots; seven large reserves plus two small reserves. The fixed Bight bridge and ZIP/G1 layout remain for the reserved design decision. No API key was requested, inspected or used. No external message, main merge, push, deployment, default-world switch or data/schema action was performed.

## Changes

The land builder now constructs genuine 1:6 retaining faces against final terrain, opens connected paths and lower passages through appropriate walls/rails, offsets crossing columns outside lower corridors with separate crossbeams, and preserves beams when settling foundations. Open spans cap intrusive ground without filling channels or cutting tunnel roofs. Town access and High Span geometry follow their physical paths. Targeted pads and preserved level approaches remove blocking junction lips.

Year Walk bypasses the Library and Cottage footprints. Library foundation rotation matches the shell. Garden Walk meets the Cottage spur at its endpoint and shares the Hollow corridor without intersecting railings. Glasshouse access considers elevation, goes around the building and levels before its apron. Camera C has a supported overlook at its fixed coordinate; underwater authored eyes explicitly fail. District residency uses polygon distances and camera-district priority, and Look restores the selected view.

A bounded independent Codex review found an attempted Lite collision/render mismatch and a wrong-side gallery rail opening. Both were removed before the tested code commit. Lite retains ground collision matched to its rendered terrain; the west gallery rail remains continuous. This source review is not Claude's required independent land audit.

Changed areas: `src/harbour/horizon/land/{beds,terrain,structures,town}`, runtime mode restoration, world districts/views, sky proxies, bake/report/walk evidence scripts, focused Horizon regressions and generated terrain/world assets. Financial/App writer code is outside this diff.

## Verification

- Full and Lite actual runtime walks: **7/7 in each tier**, all seven existing door callbacks reached, from the town square with collision enabled and no teleport during a route. Baseline full was 3/7. Not manual device or financial-tool integration proof.
- High scoped quick gate on the clean code commit: **PASS, 132.632 seconds against 300 seconds**, with all phases and **39 tests across seven files passed**; TypeScript was 101.980 seconds. The earlier concurrent run took 425.419 seconds and failed its time budget. Both records remain; the unchanged-code isolated retry resolves the gate without reclassifying the earlier overrun. No exhaustive gate.
- Ordinary `pnpm build`: exit 0, including Node 22 asset checks, application/workspace typechecks, Vite, Hercules UI and redirect guard. Dependency and bundle-size warnings remain in the raw log.
- Node 24 `bake-terrain.mjs --check`: passed in 121.613 seconds. Node 22 check within build passed in 250.092 seconds under concurrent load. Terrain/plain JSON exact; gzip decoded content exact under the repository portability contract.
- Broader Horizon tests: first final-code run under other local load recorded 117/118 pass, a 60-second structural-test timeout and two worker RPC timeouts. Retained as failed evidence. An unchanged-code retry with other validation stopped passed **118/118 across 27 files in 21.75 seconds**, with no unhandled errors.
- 48 authored-camera captures: 12 views × 2 hours × full/Lite, zero page exceptions. 20 extra captures: night, E/Journey camera parity, 20 mode changes and four-district relocation. Source unchanged; served assets match disk. Five console warnings, no other browser errors. Actual mode-toggle wall time was 24.868 seconds; do not claim a certified 100 ms stress test. Timings were collected under other local load, not a physical-device benchmark.
- Raw probes: 10/10 named span parts/thickness, 5/5 tunnel parts/clearance, 9/9 reserves, 4/4 underground covers and 87/87 route grades pass. The 113 raw footing flags all identify horizontal crossbeam components, with no other flagged footing components; this does not establish complete load paths. All raw data is retained.

Exact commands and logs are in the delivery's `VERIFICATION.md` and `verification/`. Core commands: `pnpm test -- --risk=high --base=0f601b55054fbc55ca997b172f4a1e9daf0ce79d --focus=test/horizonLandRepairs.test.ts --focus-reason="Physical land repairs, route collision and view continuity"`; `pnpm build`; Node 24 `node scripts/horizon/bake-terrain.mjs --check`; `node node_modules/vitest/vitest.mjs run test/horizon --maxWorkers=1`; `walk-proof.mjs` separately with `HORIZON_TIER=full` and `lite`; `capture.mjs`; `extra-evidence.mjs`; `report.mjs`; unchanged raw track-B probe. Browser evidence used local port 5199 and headless Chromium/Apple M2 Metal.

## Open gates and next owner

186 geometry conflicts; 69 raw terrain-bed gap samples; five failed cable crossings; 11/12 authored view proofs fail; seven of nine travel targets fail at scale 1.0. Crossing register reconciliation, load-path/edge-protection audit, terrain cut continuity and silhouette/composition enhancement remain. The Bight gap remains about 243.765 m against the fixed 230 m bridge; ZIP/G1 clearance remains reserved. No finding is silently waived.

Physical Mac/iPhone feel, accessibility, night contrast, live tool integration, Claude review, Jonathan's visual decision and PIN-1 are unperformed/open. The new overlook and locally revised public paths require explicit review as implementation proposals.

Delivery: `~/Downloads/hearth-horizon-p1-repairs-claude.zip`, with source bundle and human-readable diff, exact SHA/hash manifest, 68 screenshots, source-review findings, raw numeric reports, build/test logs, contracts and finish prompt. Historical `hearth-horizon-p1-land` is unchanged. Next owner: Claude, for independent review first and enhancement in separate commits; Jonathan owns the reserved design choices and acceptance. See [the durable brief](../briefs/HORIZON_LAND_REPAIRS_CLAUDE_HANDOFF.md).
