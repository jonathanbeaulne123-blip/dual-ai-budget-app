# Hearth worksession — Horizon rendering work

- Status: CLOSED — local implementation verified; release and physical-device acceptance separate
- Opened: 2026-09-28 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex, with bounded read-only lifecycle review
- Branch: codex/horizon-render-work
- Baseline: a538f75c6023978ca8f2900dd8ec870e349b5d63 (verified origin/main)
- Risk: Medium-High — streamed construction, rendering lifecycle and collision queries
- Environment: local synthetic scenes only

## Household outcome
Smoother district arrivals, less idle rendering work, and less allocation during movement.

## Dual Course
Budget (5): responsive access to existing tools; no accounting or Confirm change.
Engagement (3): preserve authored geometry and movement while reducing repeated work.

## Scope and invariants
Jonathan selected optimization items 1, 2 and 4. Implement interruptible visual construction, idle update/render suppression, and allocation reduction/shared static collision data. Physics, loaded-ground gates, exact geometry, themes and accessibility remain authoritative. Adaptive quality is outside this request. No hosted data, schema or Production changes.

## Acceptance
- Deferred construction preserves completed geometry and disposes cancellation safely.
- Collision results match the baseline; fleet excludes dynamic people/boat geometry.
- Rested views wake on input, chunk arrival, partner updates, date/theme/home changes and resume.
- Focused regression gate and before/after local measurements; physical-device limits explicit.

## Implementation
- `src/house/world/buildTask.ts`, `src/harbour/art/cardScene.ts`, `src/harbour/horizon/runtime/cards.ts`: cancellable cooperative builders, preserving synchronous callers and complete geometry.
- `src/harbour/horizon/world/districts.ts`: one pending visual build, cancellation on reprioritization, revision-based presentation invalidation and idle maintenance deadlines; existing collision readiness and resident caps retained.
- `src/harbour/horizon/runtime/cableLayer.ts`: reuse each cable system until its solids or anchor readiness changes.
- `src/harbour/horizon/runtime/geography.ts`: shared static index with dynamic-free hull queries; reusable triangle/intersection/contact scratch, fresh public results.
- `src/harbour/horizon/runtime/frameLoop.ts` and `runtime/index.ts`: demand rendering, explicit wake points, hidden/lease/dispose cancellation, 100 ms idle polling, elapsed-time reset on wake, cached residency/fade/FOV updates.
- Tests: `horizonRenderWork`, `horizonRuntimeGeometry`, `horizonStreaming`; decision log updated.

## Measured evidence
Baseline is the base SHA above. Local Apple M2, Chromium ANGLE Metal; synthetic checked-in island assets, no authenticated app or household data.

Controlled Lite microbenchmark: one warmup plus seven measured runs per version, alternating order with GC between stages; 2,000 positions each query surface, ceiling, contact and hull blocking. Exact collision-result SHA-256 and generated geometry-attribute SHA-256 agree across all before/after runs.

| Measurement | Before | After |
| --- | ---: | ---: |
| Collision workload median | 401.96 ms | 287.57 ms (28.5% less) |
| Static index creation median | 243.41 ms | 124.81 ms |
| Live triangle-reference estimate | 18,048,720 bytes | 9,024,360 bytes |
| Harbour visual construction median total | 118.16 ms synchronous | 95.56 ms across slices |
| Cooperative slice p95 / maximum | N/A | 3.48 / 6.95 ms |

Index bytes estimate triangle-reference storage, not total heap/GPU memory. Slice timing is CPU construction only, not a whole-frame or GPU-upload guarantee.

Browser comparison: Lite 390×844 and Full 1440×900, DPR 2. After all 14 chunks load and fades settle, both tiers went from 120 rendered frames per two-second idle sample to zero. Paused scenes went from 60 frames per second to zero. Walking produced 120 frames in about 2.004 seconds (~59.9 fps) with consistent displacement. Lite 38,118 / Full 74,051 triangles are unchanged. Splitting cable systems adds one draw call (32→33 Lite, 45→46 Full).

Final browser checks passed all three theme setters, home/date/page changes, Journey/Look switches, pointer drag, resize, partner expiry, unpause and hidden→visible resume in both tiers. Hidden partner changes in Journey, hidden scenes, paused scenes and disposed scenes all generated zero sampled frames; no browser errors. A subsequent frame-driver guard covers synchronous suspend/dispose inside a render callback with dedicated tests.

Cold-start samples still include long tasks up to 326 ms in Lite and 285 ms in Full. Before/after startup samples were sequential with uncontrolled cache/order and are not a rigorous startup speedup claim.

Raw JSON, screenshots, exact harness scripts, source/test hashes and gate logs are saved outside Git in workspace `artifacts/horizon-render-work-2026-09-28/`. The scripts preserve their original temporary output locations and baseline reads; pin to the recorded base if replaying after a commit.

## Validation
- Browser and controlled benchmark commands (run from this checkout with the bundled Node runtime): `node --expose-gc /tmp/hearth-horizon-opt/bench.mjs`, `node /tmp/hearth-horizon-opt/browser.mjs`, `node /tmp/hearth-horizon-opt/browser-final.mjs`.
- Workspace TypeScript passed: `pnpm_config_verify_deps_before_run=false pnpm run typecheck:workspace`.
- Initial quick gate found two test-fixture typing errors (112.8 s, no timing breach); corrected the fixture annotations. Final repository quick gate passed: 402/402 tests across 29 files, TypeScript, AI surface and diff checks in 165.073 s; `timeBudgetBreached:false`. All commands use `pnpm_config_verify_deps_before_run=false` to preserve the verified shared dependency installation.

## Remaining limits
The 3 ms construction budget is cooperative: a single cell conversion, chalk upload, synchronous chunk parse/index, cable change or GPU upload can exceed it. Initial coarse construction and shader compilation remain synchronous. Walking keeps simulation running; only settled Look/Journey/paused views rest, and visible ambient partner motion retains animation. Physical iPhone, Safari, full-app overlays, prolonged thermal load, two-device presence and accessibility acceptance remain separate. Adaptive quality is not implemented. This work cannot certify 60 fps at all times.

## Handoff
Implementation and local validation complete. Jonathan authorized push and merge on 2026-09-28. The associated pull request records the final CI and merge result. No manual deployment or hosted data action is included; hands-on device acceptance remains open.

Gate source/tests were unchanged after the successful run; this worksession evidence was finalized afterward. No exhaustive gate was run.

## Exact final gate command
```sh
pnpm_config_verify_deps_before_run=false pnpm test -- --risk=medium-high --focus=test/horizonRenderWork.test.ts --focus=test/horizonRuntimeGeometry.test.ts --focus=test/horizonStreaming.test.ts --focus=test/horizonTerrainAsset.test.ts --focus=test/horizonCruiser.test.ts --focus=test/horizonFleet.test.ts --focus=test/horizonComfort.test.ts --focus=test/horizonPartner.test.ts --focus=test/mountain-finishing.test.ts --focus-reason='Cooperative district construction, shared static collision queries, cable caching and resting-frame lifecycle with shared CardBuilder regression coverage'
```
