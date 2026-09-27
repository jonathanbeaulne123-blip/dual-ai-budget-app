# Hearth worksession — Integrated airborne parachute

- **Status:** IMPLEMENTED — validation in progress
- **Opened:** 2026-09-27 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; read-only movement/camera and ownership audits
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** codex/integrated-parachute
- **Baseline SHA:** 22c95b8b82cb3774f0b5f2aba6f562825aff6b0c
- **Risk:** High (movement authority, physics, input and cameras)
- **Environment impact:** none; local Horizon development entry only

## Household outcome

Opening a parachute is a normal airborne action after walking jumps, falls, board/bicycle airtime, glider flight or the existing plane door seam. Jonathan explicitly replaced the initial plan-edit request with implementation. The existing 02 — Movers plan is unchanged.

## Budget delta (5)

+0. No accounting, commands, Auth, cloud, household data or Final Confirm changes.

## Engagement delta (3)

+2 intended: continuous jump/fall/open/retract/reopen movement, retained equipment and predictable camera choices.

## Verified baseline and scope

Fresh clone of current main with existing Horizon runtime and flight controller. The aircraft is a registered provider seam, not a completed plane controller. The old chute required 60 metres AGL and automatically opened at 45 metres; foot movement clamped cliff departures. These restrictions are replaced in runtime code. No weather programme, tricks/progression, new plane, merge or deployment is included.

## Acceptance evidence

- Physics: exact source position/full velocity, finite canopy inflation/drag, repeated toggle anti-pumping, very low openings, stable support, walls/ceilings, terrain readiness and shared wind.
- Integration: one active controller; retained board; valid landing resume and nonrideable recovery; boost/jump cleanup; short-frame input; keyboard/touch and camera persistence.
- Visual: local desktop/phone review, all three existing theme treatments. Physical iPhone/Mac acceptance remains separate.

## Evidence log

- Baseline and branch verified before editing. One writer; independent agents read only.
- Initial focused physics/controller/reduced-motion run: 49 tests passed (3 files, 3.54 seconds).
- Final focused command: `pnpm exec vitest run test/horizonChute.test.ts test/horizonGliderController.test.ts test/horizonGliderReducedMotion.test.ts test/horizonModeRegistry.test.ts test/horizonPerspective.test.ts test/horizonBoardLanding.test.ts test/horizonMoverHook.test.ts --maxWorkers=1`: **99/99 passed**, 7 files, 106.38 s.
- `git diff --check`: passed. `pnpm ai:verify`: passed (48 required files, 2 Clerk fences).
- `pnpm test -- --risk=high --focus=test/horizonChute.test.ts --focus=test/horizonGliderController.test.ts --focus=test/horizonGliderReducedMotion.test.ts --focus=test/horizonModeRegistry.test.ts --focus=test/horizonPerspective.test.ts --focus=test/horizonBoardLanding.test.ts --focus=test/horizonMoverHook.test.ts --focus-reason="Airborne physics, equipment ownership, controller handoff, landing, controls and camera regression coverage"`: **300 s budget exceeded during TypeScript**, still running. This began before the final slope/water fixes and is not exact-final-tree certification.
- Actual local Horizon browser entry: foot jump → low deployment → first person → landing → floating view passed with no browser errors. The selected first-person view survived landing.
- Independent read-only audit reproduced and verified fixes for downhill support, water over a steep seabed, dry bridge landings, shore fades, retained equipment, high-frame-rate input and camera heading/FOV.
- Desktop/phone theme matrix and final repository diagnostics are pending.

## Decisions

Space opens/retracts in the air, remains jump on foot/board; touch uses the matching labelled action. A held press never reopens after landing. Foot falls use the same airborne owner even before deployment. Board/bicycle controllers are retained while stowed and resume only on legal dry rideable support. First-person/floating perspective is a separate camera choice, never movement authority. Comfort settings use the stable flight camera for ordinary falls rather than teleporting an ordinary jump to a destination.

## Remaining uncertainty and handoff

Implementation complete; broader verification remains open. No hosted release or physical-device acceptance is claimed. Jonathan owns gameplay feel acceptance.
