# Hearth worksession — Rendering toward steady 60 fps

- Status: OPEN
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
- [ ] Before/after local browser measurement, renderer identified.
- [x] Explicit separation from physical phone / complete-scene acceptance.

## Verified baseline
Current main deliberately caps phone Harbour motion at 30 fps; elapsed-time comparison also drops refreshes around fractional 60 Hz timestamps. Horizon spatial streaming computes the same geometric selection twice every frame.

## Evidence log
Fresh isolated clone avoids modifying older shared checkouts. Local dependencies reused from tool-atlas-integration; both pnpm lockfiles have SHA-256 dda5083e41ccda15722ac7126726578de521bbd5e8428607cdf45d7fd8ac4a37. Local review uses synthetic data and no sign-in. Read-only audit identified district-selection work, Journey label layout reads, and kitchen preview allocation.

## Remaining uncertainty
Physical Mac/iPhone sustained traversal, thermal throttling, all authored scenes and GPU capacity. Browser timings alone cannot certify 60 fps at all times.

## Handoff
Implementation in progress; no push, merge or deployment.

## Preliminary measurements

- First focused run: 90/90 tests across seven files, 22.98 s; before additional label-layout and kitchen re-entry assertions.
- Seven-run median microbenchmark, 30,000 updates on the checked-in Horizon world: stationary district update 11.243 → 1.013 µs (91% less); moving 11.109 → 6.970 µs (37% less). This is spatial-selection CPU work, not whole-frame improvement.
- Local headless Chromium on ANGLE Metal / Apple M2, 1440×900 Full and 390×844 Lite: Horizon page A stayed at approximately 60 fps before and after, with unchanged draw counts (45 Full, 32 Lite) and no page errors. Ten-second captures after 15-second warmup. This is an M2 with a phone-sized viewport, not a physical phone.
- First quick gate exceeded 300 s during TypeScript and was interrupted. A simultaneous Harbour/Mountain browser probe ran under severe host memory pressure (8 GB machine, 6% memory free); discard those FPS numbers as a comparison. Serial revalidation started.
- Bundled pnpm initially attempted to replace the shared dependency directory and aborted without a TTY. No purge authorized/performed. With identical lockfiles verified, use `pnpm_config_verify_deps_before_run=false` for this session only; no project package setting changed.

## Verification result

Serial Medium quick gate: **765/765 tests across 47 files pass** (598 fast + 167 serial); TypeScript and AI-surface verification pass. Total 405.988 s; the five-minute budget was exceeded during serial tests. Classification: `quick-gate-passed; time-budget-breached`, not exhaustive/release verification. Source and tests have not changed after this run; subsequent edits only complete the evidence document.

Command (with the bundled Node/pnpm paths on PATH and the session-only dependency-check setting described above):

```sh
pnpm test -- --risk=medium --focus=test/world-frame-pacer.test.ts --focus=test/harbour-world-frame.test.ts --focus=test/horizonStreaming.test.ts --focus=test/horizonKitchenArt.test.ts --focus=test/yachtKitchenActivity.test.ts --focus=test/journey-integrated-ui.test.ts --focus=test/wave2b-glass-wiring.test.ts --focus-reason="Proves 60 Hz pacing, streaming readiness and grace, reusable aim geometry, hidden camera cleanup, and theme label layout"
```

Regression coverage includes 60 Hz timestamp rounding, 90/120/144 Hz pacing, suspension/resume, both Harbour tiers, reduced motion, renderer ownership, streaming ready/grace/underground/relocation behavior, all three Journey themes, unchanged aim uploads and changed bounds, hidden kitchen camera cleanup/re-entry, and existing actual-App synthetic authority tests. No real household or hosted service was changed. A read-only reviewer found no blocking code regressions.
