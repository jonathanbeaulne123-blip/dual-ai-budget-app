# Hearth worksession — Harbour skateboarding

- **Status:** CLOSED — local implementation complete; release acceptance remains open
- **Opened:** 2026-09-23 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex, with independent read-only integration, world-design and verification agents
- **Repository:** dual-ai-budget-app
- **Branch:** `codex/harbour-skateboarding`
- **Baseline / initial HEAD:** `8f469a21554136984942b616d2f5799d7c88d63e` (freshly fetched GitHub main)
- **PR:** none; push needs Jonathan's confirmation
- **Risk:** Medium-High — interactive physics, input lifecycle and ephemeral partner presentation
- **Environment:** local synthetic Development preview; no hosted changes

## Household outcome

Jonathan and Bianca can choose a skateboard, ride around their actual island, learn tricks, link lines through authored ramps and rails, discover skate spots and follow optional routes. This is an original Hearth skate game inspired by the requested feeling of Skate 3, with its own geometry and systems.

## Budget delta (5)

0: the existing books, reads, commands, persistence and room access retain their meaning. Skate progress is device-local recreational data, partitioned by environment, household and member. No spending reward, financial gate or new household writer.

## Engagement delta (3)

+3 intended: a controllable board, skill-based tricks and combos, a purpose-built park plus island street spots, route challenges and honest live partner riding.

## Verified baseline

Main contains the seven-building village and expanded island (#526/#527), procedural walkers, playable Jonathan/Bianca surfaces, obstacle-aware walking, a leased Three renderer and opt-in ephemeral world presence. The original OneDrive checkout is older and dirty; it is preserved. Real authenticated two-device skating has not been verified.

## Scope

- Deterministic board motion, terrain contact, ollies, flip/shove/spin tricks, manuals, rail capture/balance, landings/bails and instant recovery.
- Original park with transition ramps, launchers and grind lines; satellite spots and routes tied to existing island landmarks.
- Responsive skate HUD, keyboard/touch controls, board selection, help, score/progress and a session marker.
- Reduced-motion and tool/focus/visibility suspension; reachable walking and all existing financial doors.
- Sanitized bounded skate pose on the existing explicitly opted-in presence lane, with honest stale/offline behavior.
- Classic, Taylor and Newfoundland treatments; deterministic tests, focused quick gate, production build and browser evidence.

### Outside this authorization

Push, merge, deployment, hosted schema/data, secrets and Production actions. No copyrighted game assets. A commercial-quality claim requires further device and player acceptance; no claim of parity with a studio game from source tests alone.

## Acceptance evidence

- [x] Fixed-step riding is stable at 30/60/120 fps; thin-wall, shoreline and stalled-frame cases pass.
- [x] Ramp launches, completed/unfinished tricks, aligned rail capture/rejection, manuals, combos, fakie momentum, transition rollback and recovery have executable behavioral tests.
- [x] Discovery and sequential route completion require physical positions; malformed, unavailable and quota-failed device storage fail safely.
- [x] Browser proof covers keyboard tricks with a HUD button focused, pointer trick controls, pause/resume, deck and phone-trick selection, route start, spot travel, walking exit and opening/closing household tools. Physical touch riding remains a device acceptance item.
- [x] Two authenticated local Worker sockets transmit only bounded ephemeral skate pose. Actual Village partner presentation, stale disappearance, walking reset and shoreline extrapolation are tested.
- [x] 320/390/720/about-1100 widths, Classic/Taylor/Newfoundland, reduced motion and loading fallback inspected. A live responsive rebuild preserved score/board and returned paused. Latest browser error log was empty.
- [x] Focused quick gate, its otherwise-skipped serial tests, build and independent reviews recorded below; one baseline Windows test defect remains.

## Plan

1. Inspect integration seams and island spaces (read-only agents).
2. Author shared geometry, pure simulation and tests; integrate the existing walker/renderer.
3. Add the recreational loop, controls, board styling and partner representation.
4. Exercise actual gameplay; fix physics and presentation defects; run focused verification.
5. Record evidence, residual limitations and a concrete local handoff.

## Evidence log

Baseline fetch and clean isolated branch verified. Package installation uses the locked dependencies. No household exports, environment files or credentials copied.

### What was built

Six original spots contain eight shared render/contact ramp profiles and six rails. Five timed checkpoint routes connect the park, lighthouse, coast, orchard and meadow. Six decks, discoveries and six skill milestones are recreational device-local progress. Riding includes pushing, coasting, braking, carving, ollies, kickflips, heelflips, shuvits, 360 flips, grabs, air turns, fakie landings, grinds, manuals, balance, diminishing repeated-trick scoring, combo banking, bails and practice markers. The phone and keyboard controls share one simulation. Optional synthesized wheel, rail and landing sound starts only from an explicit gesture.

The existing leased renderer/frame loop owns every skate object. Park meshes and collision heights use the same authored profiles. Trees and route segments are checked against both render tiers. Score/HUD publishing is throttled; world changes, visibility and tools clear held input and pause safely. A scoped checkpoint survives renderer rebuilds. The wider, forward-looking chase view follows travel rather than rotating with airborne board tricks.

Real partner boards use the existing opt-in authenticated presence seam, including bounded altitude for skate acts only. There is no bot represented as Bianca. Progress never enters a ledger command or hosted save. The worker change forwards validated ephemeral pose only.

### Executed verification

- `pnpm test -- --risk=medium-high --base=8f469a21554136984942b616d2f5799d7c88d63e --focus=test/harbour-skate-model.test.ts --focus=test/harbour-skate-presence.test.ts --focus=test/world-presence-worker.test.ts --focus=test/world-presence-lane.test.ts --focus=test/harbour-body.test.ts --focus=test/harbour-source-fences.test.ts --focus=test/harbour-walk-everywhere.test.ts --focus-reason="Skate movement, route collisions, scoped progress and authenticated ephemeral presence"`: diff check, AI surface and TypeScript passed. Fast selection: **872 passed / 1 failed**, 83 files. Gate stopped at **95.2 seconds**, with **no five-minute SLA breach**.
- The sole failure is `test/workspace-deployment.test.ts:17`: `/review/workers/workspace/Dockerfile` versus Windows `C:\review\workers\workspace\Dockerfile`. An independent reviewer reproduced it, and verified the test, deployment helper and both configuration inputs are byte-identical to the exact baseline. It is not a skate regression. The quick gate is **not** reported green.
- Reconstructed the same gate's six serial selections, then ran `pnpm exec vitest run test/app-startup-p1.test.ts test/hearthside-memory-browser.test.ts test/hearthside-nest-export.test.ts test/hearthside-workspace-browser.test.ts test/plan-system.test.ts test/workspace-merge-review-browser.test.ts --maxWorkers=1 --testTimeout=30000`: **117/117 passed**, six files, **89.3 seconds**. Combined selected checks: **989 passed / 1 baseline failure**, 89 files.
- After the final camera-angle refinement: `pnpm exec vitest run test/harbour-skate-model.test.ts test/harbour-skate-presence.test.ts test/village-runtime-camera.test.ts test/harbour-camera-poses.test.ts test/harbour-world-frame.test.ts --maxWorkers=4`: **88/88 passed**, five files, 5.9 seconds. This includes all **34 new skate tests**.
- `pnpm typecheck:workspace`, `pnpm exec vite build`, `pnpm build:hercules-pro-ui` passed. Final camera build also passed; `dist/_redirects` is absent. Vite retains its advisory large-chunk warning. No exhaustive full lane was authorized or run.
- Independent integration and world/trust reviews produced fixes for fakie/rollback behavior, camera mode preservation, HUD key routing, session restoration, radial presence bounds and partner height reset. Final review found no remaining concrete P1/P2 in those paths.
- Actual browser acceptance used the repository's synthetic local whole-house preview at `http://127.0.0.1:4196/__review?member=MEM-001&seed=demo`, without hosted services or an environment file. On-screen and focused-button keyboard tricks landed and banked points. Three themes, reduced motion, small phone controls, modal focus, board unlock presentation, scene reload and tool return were inspected. Screenshot/AX evidence is in the task conversation; local command logs are ignored under `.whole-house-review/`.

### Remaining acceptance limits

This is a substantial playable original implementation, not proof of commercial or Skate 3 parity. Two physical devices skating together through the live authenticated service, sustained mobile frame rate, simultaneous finger controls, game-feel playtesting and offline cold reload remain unverified. The local simulation, progress and stale/offline peer rules are covered in code/tests; those are not substituted for live-device evidence. No gamepad support, authored animation rig, competitive server scoring or downloadable offline shell is claimed.

## Handoff

Ready for Jonathan's local playtest on `codex/harbour-skateboarding`. Budget delta **0**; engagement delta **+3 intended**. The books remain authoritative and unaffected by recreational points. Next recommended action is to try the park and one exploration route, then perform a two-device Development presence smoke before release consideration. Push, PR publication, merge, deployment and Production remain unperformed; Jonathan retains the release decision.
