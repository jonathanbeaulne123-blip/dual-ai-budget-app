# Hearth worksession — Rendering toward steady 60 fps

- Status: COMPLETE — local implementation and measured scoped validation; physical-device acceptance open
- Opened: 2026-09-28 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex; bounded read-only rendering audit
- Repository: dual-ai-budget-app
- Branch: codex/rendering-60fps
- Baseline / head: b1a145474d7439ee3e522f1d4e5d54d1d4028919 (fresh shallow clone of verified origin/main)
- Risk: Medium — rendering, frame scheduling and nonfinancial presentation only
- Environment impact: local fictional review; no hosted changes

## Household outcome
Responsive world navigation and tools, targeting 60 fps on active views. Sustained physical-device performance must be measured; no universal frame-rate guarantee.

## Budget delta (5)
Faster navigation to existing budget tools; accounting, identity, continuity and Final Confirm unchanged.

## Engagement delta (3)
Smoother camera/player movement and less repeated rendering work, preserving the authored scenes and themes.

## Scope
Frame pacing, repeated spatial/visual work and focused measurement. No deployment, schema, household mutation, feature removal or financial changes.

## Acceptance evidence
- [x] Regression tests for frame pacing, lifecycle and streaming behavior.
- [x] Current-change Medium quick gate: passed, time-budget-breached (405.988 s).
- [x] Before/after local browser measurement, renderer identified.
- [x] Explicit separation from physical phone / complete-scene acceptance.

## Verified baseline
Current main deliberately caps phone Harbour motion at 30 fps; elapsed-time comparison also drops refreshes around fractional 60 Hz timestamps. Horizon spatial streaming computes the same geometric selection twice every frame.

## Evidence log
Fresh isolated clone avoids modifying older shared checkouts. Local dependencies reused from tool-atlas-integration; both pnpm lockfiles have SHA-256 dda5083e41ccda15722ac7126726578de521bbd5e8428607cdf45d7fd8ac4a37. Local review uses synthetic data and no sign-in. Read-only audit identified district-selection work, Journey label layout reads, and kitchen preview allocation.

## Remaining uncertainty
Physical Mac/iPhone sustained traversal, thermal throttling, all authored scenes and GPU capacity. Browser timings alone cannot certify 60 fps at all times.

## Handoff
Local branch `codex/rendering-60fps` is implemented and validated. No push, PR, merge or deployment. Next owner: Jonathan for release direction and physical-device acceptance; a release review must use current main and this evidence boundary.

## Preliminary measurements

- First focused run: 90/90 tests across seven files, 22.98 s; before additional label-layout and kitchen re-entry assertions.
- Seven-run median microbenchmark, 30,000 updates on the checked-in Horizon world: stationary district update 11.243 → 1.013 µs (91% less); moving 11.109 → 6.970 µs (37% less). This is spatial-selection CPU work, not whole-frame improvement.
- Local headless Chromium on ANGLE Metal / Apple M2, 1440×900 Full and 390×844 Lite: Horizon page A stayed at approximately 60 fps before and after, with unchanged draw counts (45 Full, 32 Lite) and no page errors. Ten-second captures after 15-second warmup. This is an M2 with a phone-sized viewport, not a physical phone.
- First quick gate exceeded 300 s during TypeScript and was interrupted. A simultaneous Harbour/Mountain browser probe ran under severe host memory pressure (8 GB machine, 6% memory free); discard those FPS numbers as a comparison. Serial revalidation started.
- Bundled pnpm initially attempted to replace the shared dependency directory and aborted without a TTY. No purge authorized/performed. With identical lockfiles verified, use `pnpm_config_verify_deps_before_run=false` for this session only; no project package setting changed.

## Verification result

Serial Medium quick gate: **765/765 tests across 47 files pass** (598 fast + 167 serial); TypeScript and AI-surface verification pass. Total 405.988 s; the five-minute budget was exceeded during serial tests. Classification: `quick-gate-passed; time-budget-breached`, not exhaustive/release verification. This verifies commit `60708b2`. The only subsequent code change widens frame timestamp tolerance from 0.75 to 2 ms, with one added jitter regression; that incremental change receives its own gate below.

Command (with the bundled Node/pnpm paths on PATH and the session-only dependency-check setting described above):

```sh
pnpm test -- --risk=medium --focus=test/world-frame-pacer.test.ts --focus=test/harbour-world-frame.test.ts --focus=test/horizonStreaming.test.ts --focus=test/horizonKitchenArt.test.ts --focus=test/yachtKitchenActivity.test.ts --focus=test/journey-integrated-ui.test.ts --focus=test/wave2b-glass-wiring.test.ts --focus-reason="Proves 60 Hz pacing, streaming readiness and grace, reusable aim geometry, hidden camera cleanup, and theme label layout"
```

Regression coverage includes 60 Hz timestamp rounding, 90/120/144 Hz pacing, suspension/resume, both Harbour tiers, reduced motion, renderer ownership, streaming ready/grace/underground/relocation behavior, all three Journey themes, unchanged aim uploads and changed bounds, hidden kitchen camera cleanup/re-entry, and existing actual-App synthetic authority tests. No real household or hosted service was changed. A read-only reviewer found no blocking code regressions.

## Final camera measurements

The uncontended probe bundles the real Harbour/Mountain Court and renderer (no household), warms for 12 seconds, then warms an oscillating camera for 5 seconds, and captures 8 seconds. Chromium headless uses ANGLE Metal / Apple M2 on this 8 GB Mac; device scale is 2, capped by the existing renderer at 1 for Lite and 1.5 for Full. The baseline bundle substitutes the unmodified `b1a1454` runtime and frame policy. No geometry or visual quality is reduced.

| View | Baseline painted FPS | Final painted FPS | Final p95 interval | Final CPU p95 | Final samples |
|---|---:|---:|---:|---:|---:|
| Lite, 390×844 | 17.875 | 60.006 | 18.2 ms | 4.6 ms | 479 |
| Full, 1440×900 | 17.324 | 59.996 | 18.3 ms | 4.6 ms | 480 |

Both final captures have zero page errors, zero interruptions, no sample-cap truncation, and zero intervals above the existing 33.8 ms long-frame threshold. These are measured short camera scenarios, not a claim that every frame on every device meets 16.67 ms. Cold starts, changing scenes, long traversal, thermal conditions, physical iPhone and GPU saturation remain outside this acceptance.

Why the last pacing refinement mattered: a separate real rAF sequence supplied 481 refresh timestamps; the original 0.75 ms tolerance accepted only 440 in replay. Tolerances of 1.5 and 2 ms accepted all 481. The final 2 ms allowance retains the deadline-based 60 Hz budget and is regression-tested alongside 90/120/144 Hz scheduling. The interim 54–55 fps results were superseded by the final captures above.

Local raw evidence is under workspace `artifacts/rendering-60fps-2026-09-28/`: baseline/final camera JSON, Horizon before/after JSON, district benchmark, recorded rAF probe, final screenshots and gate logs. Temporary harness scripts remain in `/tmp/hearth-rendering-evidence/`; they contain no credentials or household data.

## Final incremental gate and handoff

`pnpm test -- --base=60708b2 --risk=medium --focus=test/world-frame-pacer.test.ts --focus=test/harbour-world-frame.test.ts --focus-reason="Final timing-only refinement over the already validated rendering commit; tests real 60 Hz timestamp jitter, high-refresh cadence and mounted Full/Lite rendering"` passes in **65.370 s**: TypeScript, AI-surface/diff checks, and **32/32 tests**. This verifies only the timestamp-tolerance refinement over the already tested `60708b2`; it does not replace or relabel the earlier 765-test gate's budget overrun. Only this evidence document changed after that final gate.

Changed source: shared frame pacer, Harbour policy/runtime, Horizon district selection, kitchen art/activity, Journey label layout. Tests cover each changed mechanism. All three themes retain their authored materials and UI, with theme-specific Journey assertions passing. Budget and financial state are unchanged. Browser harness and this task's preview server were stopped after capture. Remaining limits are explicit above; no universal 60 fps certification, exhaustive release gate, physical-phone acceptance, hosted deployment or real-ledger test is claimed.
