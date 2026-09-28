# Hearth worksession — Island cruiser

- Status: implemented and browser-tested locally; full repository gate remains open
- Opened: 2026-09-27 (America/Toronto)
- Decision owner: Jonathan; implementer/integrator: Codex
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: codex/island-cruiser
- Original baseline: 22c95b8b82cb3774f0b5f2aba6f562825aff6b0c (fresh isolated clone)
- Integrated baseline: origin/main 4685a6d05d3069ea1c600d476d3054ccb1235f35 (#554)
- PR: #555; Jonathan explicitly requested merge after creating the draft
- Risk: Medium-High, shared recreational movement, camera and input lifecycle
- Budget delta (5): +0; no financial, Auth, books or Final Confirm changes
- Engagement delta (3): +2 intended; quick, forgiving island travel
- Environment: local Development; no deployment, hosted mutation, schema or secret access

## Outcome and scope

One registered cruiser controller and one tuning object, with Vespa-style and Harley-Davidson-style procedural models of equal physical dimensions. Ride/Get off, scoped device-local skin preference, existing Look/Island pause and Walk resume, touch controls, recovery and checked nearby dismount. The existing renderer lease and exclusive mover registry own every frame. Dry off-road terrain stays available. The board retains its expressive physics. Classic, Taylor and Newfoundland have distinct vehicle materials and controls.

Current main has Horizon board/bicycle and glider/parachute movers. Horizon uses the existing Development `?world=horizon` App route and the local review page. Onboarding replaces the URL: add `world=horizon` to the canonical `/house/home/middle?...` URL after entering the app. The normal App was tested separately from the review page.

#554 is now integrated. The shared C cycle supplies activity, first-person and floating views; own rider/vehicle art hides locally in first person. V during airtime puts the vehicle away and transfers exact position, heading and velocity to closed-canopy freefall. Space while already airborne transfers directly to an open parachute. The single shared airborne owner handles gravity and landing; landing returns on foot and Ride is available again. Selecting a cruiser replaces previously carried board equipment, preventing an older board from auto-resuming on a later cruiser exit. Grounded dismount still checks nearby geometry. There is no additional altitude requirement.

## Tuning and controls

`src/harbour/horizon/movers/cruiser/tuning.ts` is the sole physical configuration. Cruise 16 m/s against island manifest board 7 / cart 8; acceleration 7.5 m/s², braking 16 m/s², reverse 2.5 m/s. Steering reduces target speed toward 8 m/s at full deflection. The 120 Hz fixed step has matching results at 10, 20, 30, 60 and 120 input frames per second. Below 10 rendering frames per second the runtime bounds catch-up for safety.

W/up accelerates. S/down brakes; release and press again at rest to reverse. A/D or arrows steer. Space hops; a fresh Space during airtime opens the parachute. C changes perspective. V mounts/gets off (freefall when airborne); R recovers. The Ride pad uses the same inputs; Hop and the separate Look pad work on narrow screens. Camera drag never steers the vehicle. No balance, damage, gears, fuel, boost or rain grip penalty.

## Review and refinements

Two independent read-only reviewers audited movement and camera/access integration. Findings repaired: uphill terrain penetration, steep landing penetration, diagonal-boundary normal normalization, held-input replay, lateral energy growth through turns, rider seating, wheel-camera ownership, live theme materials, narrow selector overflow, pointer focus swallowing the ride pad/Hop, and support across tiny deck seams. The seam fix requires support on both sides of the wheel footprint, preserving real ledges and intentional jumps. Solid buildings and raised road obstacles remain solid.

## Measured riding evidence

Ignored local artifacts: `artifacts/browser-evidence/island-cruiser-2026-09-27/`. Browser runs use headless Chromium on Apple M2 Metal with all non-loopback requests blocked. This is automated interactive validation, not physical-phone or human ride-feel acceptance.

- `review-report.json`: passed. Real keyboard/pointer input: open-road acceleration and braking without accidental reverse, both skins, stationary turn, hop/airborne dismount refusal, camera pause/resume, held-input dismount without walking drift, three repeated mount/dismount cycles, recovery, phone ride pad and Hop. Zero page errors. Twelve viewport/theme captures (320, 390, 720, 1100 px × all three themes), no horizontal overflow.
- `live-driving.json`: passed. Real-time analog inputs through the same runtime input API as the pad; initial diagnostic restore sets only each start. S1 downhill 92.48 m in 11.41 s, peak 10.39 m/s, zero contact samples, stopped 0.69 m from endpoint. Village passage 32.87 m, peak 5.6 m/s, zero contact samples. Home approach stopped 0.484 m before its target, with safe dismount. The scene, simulation and camera all ran normally.
- `routes.json`: passed. Separate accelerated fixed-step simulation over the actual baked/rendered collision geography. Main road V01 460.22 m in 30.60 simulated seconds; S1 189.26 m in 16.74 s including the repaired seam; storefront 41.00 m. Each stopped within 1.01 m of its endpoint, no stationary interval above 0.009 s, peak speed at most 16 m/s.
- `app-smoke.json` and `app.png`: actual App passed demo entry, Jonathan selection, Horizon mount, Ride with Harley art, Get off and scoped Harley preference after reload. Zero page exceptions. Three expected console failures were blocked Google Fonts requests. No financial action or external write.

The main-road script deliberately steers 1.5 m east around a solid raised layby corner. This exists only in the test driver; the vehicle has no automatic route steering. Exploratory whole-route attempts are retained in `routes-exploration.json`: the simplistic pilot skipped a 137.8° hairpin apex and left the 4 m lane, then correctly hit its outer wall. The accepted downhill segment ends before that hairpin. This is bounded route evidence, not full-island or whole-hairpin acceptance. Direct-wall, glancing-contact, kerb, underpass, off-road, recovery and confined-dismount behavior also have deterministic geometry tests.

## Verification commands and result

```sh
pnpm test -- --risk=medium-high --focus=test/horizonCruiser.test.ts --focus=test/horizonRuntimeGeometry.test.ts --focus=test/horizonModeRegistry.test.ts --focus=test/horizonMoverHook.test.ts --focus=test/horizonQuickLayerModes.test.ts --focus=test/horizonChute.test.ts --focus-reason="Cruiser physics, real collision geometry, exclusive movement ownership, inputs and Horizon controls"
pnpm exec vitest run test/horizonCruiser.test.ts test/horizonRuntimeGeometry.test.ts test/horizonModeRegistry.test.ts test/horizonMoverHook.test.ts test/horizonQuickLayerModes.test.ts test/horizonChute.test.ts --maxWorkers=2
node scripts/pack-mountain-terrain-asset.mjs --check
node scripts/horizon/bake-terrain.mjs --check
pnpm typecheck:workspace
pnpm exec vite build
pnpm build:hercules-pro-ui
```

Browser reproduction: start Vite on 127.0.0.1:5206 with `VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 VITE_FUND_MODEL_V2=1 VITE_CELLAR_V3=1`; run `node scripts/horizon/cruiser-proof.mjs`, `node scripts/horizon/cruiser-routes.mjs`, and `node scripts/horizon/cruiser-driving-proof.mjs`. `CRUISER_PROOF_URL` can select another local server. Logs and synthetic browser artifacts stay local and ignored.

Final focused run: **75/75 passed across six suites** in 43.97 s, including 17 cruiser regressions. A supplemental TypeScript compiler-API check passed all 13 changed source/test files on the final source after correcting two type annotations (camera tuple mutability and numeric dismount radius); this is not full-repository type verification. Those annotation fixes do not change emitted movement behavior. Diff and AI surface checks passed. Mountain and Horizon baked-asset checks and workspace-worker TypeScript passed. The first quick-gate attempt was interrupted/superseded after 550.0 s in TypeScript, with an explicit 300 s budget breach. The retry was also interrupted after **639.5 s** (637.0 s in TypeScript), with another 300 s breach and no complete repository TypeScript result. The 8 GB host was using about 9.9 GB swap. The quick gate is **incomplete/failed**, not passing. Only proof-script/documentation and the two erased type annotations changed after that attempt began. The production bundle completed in **5 m 43 s**; companion UI/rig build and the redirect-output check also passed. Build warnings concern existing browser-external Node modules, PGlite eval and large chunks. The final cosmetic lean-direction correction followed that bundle build: 17/17 cruiser tests were rerun (5.79 s), the 13-file TypeScript check passed again, and both steering directions were checked against the rendered model quaternion to confirm inward lean. This correction does not change handling; the bundle was not rebuilt again for that cosmetic sign change. A third gate began clean at implementation commit `0b9632540017a82066c90efa171a3a8aa1431446`; another concurrent compiler appeared after it began, and it was interrupted at **350.6 s** in TypeScript after the budget breach. The cosmetic lean correction is later than that gate snapshot. No complete repository TypeScript result is claimed. No exhaustive gate was requested or run.

## Handoff and open acceptance

Next integrator: Codex, completing the explicitly authorized merge, then Jonathan for ride feel. #554 camera/parachute integration is included in this change. Preserve one movement owner, one tuning object, geometry-checked dismount/recovery, scoped cosmetic storage and all ledger/Confirm boundaries. Do not infer deployment authorization.

Physical phone thumb feel, Mac interactive feel, GPU performance, screen-reader usability and whole-island/hairpin acceptance remain open. Complete the repository check on a less memory-constrained host if the local run cannot finish. Then review and playtest before any separately authorized release.

## Merge integration evidence

The three textual conflicts with #554 are resolved preserving both features. Read-only movement/camera review caught and corrected walking input being cleared on ordinary parachute landing, wheel writes into the active activity camera, held-Space handoff suppression, and carried-board ownership on a new cruiser pickup. Shared perspective overrides run after the activity camera. The toolbar and cruiser controls now flow vertically together instead of relying on fixed offsets that overlap when the new perspective button wraps.

Focused integration run: **131/131 tests passed across ten suites in 11.60 s** (cruiser, geometry, registry, mover hook, quick layer, parachute, perspective, board landing, glider controller and comfort). Three new cruiser cases cover grounded deployment refusal, exact velocity with both canopy states, one active owner, putting away the cruiser, and replacing previously carried board equipment. Full quick-gate and rendered integration results are recorded below when complete.
