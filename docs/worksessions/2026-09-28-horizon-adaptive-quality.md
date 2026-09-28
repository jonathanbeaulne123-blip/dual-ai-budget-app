# Hearth worksession — Horizon adaptive quality

- Status: CLOSED — local implementation verified; release/device acceptance separate
- Opened: 2026-09-28 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex; bounded read-only renderer lifecycle audit
- Branch: codex/horizon-adaptive-quality
- Baseline: e6def4e535bfe535300af9f1cffa3fc046845ed7, verified origin/main
- Risk: Medium-High — runtime rendering quality and shared renderer lifecycle
- Environment: local synthetic scenes only

## Household outcome
Keep movement responsive when the device cannot sustain the current rendering cost, and restore detail after sustained recovery.

## Dual Course
Budget (5): responsive access to existing tools, unchanged financial meaning and Final Confirm.
Engagement (3): fewer sustained missed frames, bounded quality reductions without changing geometry or movement.

## Scope and invariants
Jonathan selected optimization item 3: adaptive quality. Apply a bounded resolution/shadow ladder in Horizon. Preserve Full/Lite assets, geometry, collision, physics, authored lighting, theme, CSS layout and UI text. Do not silently change the scene's asset tier. Do not persist quality to household/device settings. The original implementation request covered local changes; Jonathan subsequently authorized push and merge on 2026-09-28. No manual deployment, hosted data or schema action is included.

## Acceptance
- Sustained slow frames lower quality; isolated stalls and idle gaps do not.
- Recovery is slower than reduction, with hysteresis and bounded settings.
- Shared renderer return, resize, hidden/visible and context restoration preserve the chosen level and redraw valid shadows.
- Focused controller/resource tests and browser overload/recovery proof in both tiers; report physical-device and CPU-bound limits.

## Implementation
- `src/house/world/adaptiveQuality.ts`: pure controller and Full/Lite raster profiles. One-second windows with at least twelve observations; two pressured windows lower one level. Eight healthy windows and at least fifteen active seconds after a reduction allow one recovery step. One-second resume warmup, half-second settling after changes, capped outlier weight, bounded history.
- `src/harbour/horizon/runtime/quality.ts`: apply resolution before painting, release/recreate shadow targets when their size changes, and derive normal bias from the actual shadow-map size.
- `src/harbour/horizon/runtime/index.ts`: sample only consecutive continuous frames, preserve the quality level across idle/hidden/paused/shared-lease gaps, restore renderer dimensions and quality on lease return, handle active/occluded WebGL restoration, expose intended/applied quality and pending status in existing developer diagnostics.
- `test/horizonAdaptiveQuality.test.ts`: pressure/recovery, 60/90/120/144 Hz, isolated stalls, bounded profiles, interruption, retained diagnostics and GPU-target disposal tests. Existing frame-driver tests also pass.
- Decision log updated. No asset, lighting colour/intensity, geometry, input, collision, financial or UI-text change.

## Browser evidence
Local headless Chromium with Metal enabled; synthetic checked-in island assets, DPR 2. Lite 390×844 and Full 1440×900. A temporary 24 ms CPU delay in the browser harness induced sustained pressure. This tests adaptation behavior and resource reduction; it is not a measured GPU-bound FPS improvement.

| Mode | Native buffer | Lowest buffer | Fewer raster pixels | Shadow target |
| --- | --- | --- | --- | --- |
| Lite | 390×844 | 292×633 | 43.85% | 1024² → 512² |
| Full | 2160×1350 | 1511×944 | 51.08% | 2048² → 1024² |

Both modes stepped 0→1→2→3 under pressure, then 3→2→1→0 after load removal. Recovery steps were separated by approximately 8.5 active seconds after the initial recovery wait. No extra quality reversals occurred. The original drawing-buffer sizes and shadow resolutions returned. Shadow-map area falls 75%; CSS viewport size and manually adjusted camera eye/target/FOV stayed identical during degradation and renderer handoff.

Both modes passed: settled idle generates no paints; manually dragged Look camera survives a foreground tool changing the shared canvas/DPR; real context loss/restoration while active; context loss/restoration while another tool owns the renderer; hidden→visible resume retains the level; idle gaps do not restore quality; all three theme setters, date update, walking input and paused idle. No browser errors. Native/reduced screenshots are retained; inspected Full reduced geometry remains coherent.

The first browser probe checked desired quality one frame before it was applied and failed its recovery-buffer assertion. Diagnostics now expose pending/applied resolution explicitly; the final probe waits for an applied frame and passes. The read-only lifecycle audit also caught a Look camera reset on lease/context return; those paths now resize without reframing, verified by exact browser camera comparisons.

## Validation
- `pnpm_config_verify_deps_before_run=false pnpm exec vitest run test/horizonAdaptiveQuality.test.ts test/horizonRenderWork.test.ts --maxWorkers=1`: 21 tests passed in 0.835 s.
- `node /tmp/hearth-adaptive-quality/browser.mjs`: both detail levels passed the final overload/recovery/lifecycle probe.
- Final focused repository gate: 369/369 tests across 26 files, TypeScript, AI-surface and diff checks passed in 139.836 s; `timeBudgetBreached:false`. Source/tests were unchanged after the successful gate; this evidence note was finalized afterward. No exhaustive gate was run.
- Raw browser JSON, scripts, screenshots and gate logs are outside Git in workspace `artifacts/horizon-adaptive-quality-2026-09-28/`.

## Remaining limits and handoff
This adapts rendering resolution; it cannot remove synchronous CPU parsing, compile stalls or sustained CPU-bound simulation cost. There is no guarantee of 60 fps on every device. Physical iPhone/Safari, sustained thermal load, full-app overlays and visual acceptance remain separate. The lowest raster resolution is deliberately bounded, and the asset tier never changes. Only Horizon uses the controller in this request; other renderers retain their existing quality policy.

Jonathan authorized push and merge on 2026-09-28. The associated pull request records final CI and merge evidence. Hands-on device acceptance remains open; no manual deployment or hosted data action is included.

## Exact final gate
```sh
pnpm_config_verify_deps_before_run=false pnpm test -- --risk=medium-high --focus=test/horizonAdaptiveQuality.test.ts --focus=test/horizonRenderWork.test.ts --focus=test/renderer-owner.test.ts --focus=test/horizonComfort.test.ts --focus=test/horizonFleet.test.ts --focus=test/horizonCruiser.test.ts --focus-reason='Adaptive frame-pressure hysteresis, shadow target lifecycle, demand rendering and shared renderer resume with movement/comfort regression coverage'
```

