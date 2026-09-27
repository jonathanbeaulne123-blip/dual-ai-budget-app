# Hearth worksession — Integrated airborne parachute

- **Status:** IMPLEMENTED — draft PR; physical-device acceptance open
- **Opened:** 2026-09-27 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; read-only movement/camera and ownership audits
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** codex/integrated-parachute
- **Baseline SHA:** 22c95b8b82cb3774f0b5f2aba6f562825aff6b0c
- **Validated code head:** 175f1dce48489b771770891fdce4b9a6cda5bc40
- **PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/554
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
- Final focused command: `pnpm exec vitest run test/horizonChute.test.ts test/horizonGliderController.test.ts test/horizonGliderReducedMotion.test.ts test/horizonModeRegistry.test.ts test/horizonPerspective.test.ts test/horizonBoardLanding.test.ts test/horizonMoverHook.test.ts --maxWorkers=1`: **100/100 passed**, 7 files, 6.34 s (includes consecutive distinct toggle presses).
- `git diff --check`: passed. `pnpm ai:verify`: passed (48 required files, 2 Clerk fences).
- `pnpm test -- --risk=high --focus=test/horizonChute.test.ts --focus=test/horizonGliderController.test.ts --focus=test/horizonGliderReducedMotion.test.ts --focus=test/horizonModeRegistry.test.ts --focus=test/horizonPerspective.test.ts --focus=test/horizonBoardLanding.test.ts --focus=test/horizonMoverHook.test.ts --focus-reason="Airborne physics, equipment ownership, controller handoff, landing, controls and camera regression coverage"`: **300 s budget exceeded during TypeScript**; stopped the obsolete local run after 681.3 s total (TypeScript 678.2 s). No TypeScript diagnostic was produced. This began before the final slope/water fixes and is not exact-final-tree certification.
- Actual local Horizon browser entry: foot jump → low deployment → first person → landing → floating view passed with no browser errors. The selected first-person view survived landing.
- Independent read-only audit reproduced and verified fixes for downhill support, water over a steep seabed, dry bridge landings, shore fades, retained equipment, high-frame-rate input and camera heading/FOV.
- Browser matrix: Classic Hearth, Taylor's Scrapbook and Newfoundland at **1280×800 and 390×844**, six passing combinations. Open/retract/reopen and C perspective controls worked; first-person hid `flight.parachute`; no horizontal overflow or browser errors. This is Chromium viewport evidence, not a physical phone test.
- CI on initial implementation 5355efca: TypeScript passed in 77.9 s; 264/265 tests passed. The only failure was the toolbar test's pre-change button list; updated it to include the authored camera control. The corrected code subsequently passed CI.
- A follow-up browser timeout revealed the probe could miss the brief opening phase after re-inflation. The probe now accepts opening or full canopy, and a controller regression separately covers distinct presses on consecutive frames.

- Final CI on code head `175f1dce` (GitHub merge ref `d351ab625f8aa62d2a06b32c6d2358d8835b6f00`): **266/266 tests in 22 files passed**, TypeScript passed in 82.1 s, quick gate total **120.872 s**, no budget breach. [CI run](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36358871839). The workflow labels its risk medium; this worksession remains High risk. Change fingerprint `923314cf2f10dfebd02fae14c911986dc0665d5d26efce89f9d2c0a9ba3936ab` matches the clean local final-code run.
- The duplicate final local high-risk quick gate was stopped during TypeScript after the matching CI code check passed. Neither stopped local run is claimed as a pass. The final executable code was checked by CI; this closing update changes documentation only.
- Horizon baked assets and bake checks passed on Node 22 and 24 in [the asset workflow](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36358871830).
- Live phone-size board proof: opened by a held pointer from a real airborne board; focus remained on the stage; the board stayed stowed; landing resumed the board; a fresh keyboard-style activation in the next jump opened again. No browser errors. No held-pointer latch survived the disappearing control.
- Local browser evidence is saved in the requesting task's outputs (`parachute-view-checks.json`, `parachute-board-smoke.json`, `parachute-smoke.json`, and six theme screenshots). These use the actual HorizonStage and runtime with synthetic starting flight positions; they contain no household data.

## Changed areas

Shared movement interfaces and registry; foot runtime and equipment presentation; board resume; parachute dynamics, controller, world contact and flight adapter; perspective director and controls; focused regression tests. Auth, cloud, ledger and existing movement plan files are unchanged.

## Decisions

Space opens/retracts in the air, remains jump on foot/board; touch uses the matching labelled action. A held press never reopens after landing. Foot falls use the same airborne owner even before deployment. Board/bicycle controllers are retained while stowed and resume only on legal dry rideable support. First-person/floating perspective is a separate camera choice, never movement authority. Comfort settings use the stable flight camera for ordinary falls rather than teleporting an ordinary jump to a destination.

## Remaining uncertainty and handoff

Implementation is committed and pushed as draft PR #554. Local gameplay evidence and CI code validation are complete; no merge, deployment, hosted gameplay acceptance, or physical-device acceptance is claimed. Jonathan owns the iPhone/Mac feel playtest and subsequent release decision. The native-app workflow and PR build are separate checks; no unrelated native release is part of this request.
