# Horizon Airport and three aircraft

- Status: implemented locally and ready for review; broader gate is not green (details below). No merge or deployment.
- Owner and decision owner: Jonathan. Assignee: Codex.
- Repository: dual-ai-budget-app. Branch: `codex/horizon-airport`.
- Baseline: `e77309efbc48a76e8328f2b427613ecc6082bb61` (`origin/main`, finished Horizon Drive).
- Risk: **High** — shared movement ownership, collision, persistence, camera and land rendering.
- Budget delta (5): **0**. No financial records, bookings, Auth, sync, schema or commands change.
- Engagement delta (3): **+3** — three distinct aircraft and a connected airport destination.
- Environment: local recreational world state only. Aircraft positions use the existing fleet storage scope plus an aircraft suffix. No new network service or external asset.

## Outcome and scope

Jonathan requested a complete airport, then clarified that no powered aircraft existed and asked for three to be designed first. Read-only inventory found the planned plane slot, glider and shared parachute, but no functioning airplane to port. New powered flight uses the existing mover registry, camera cycle, shared wind, geography and airborne handoff. One controller owns the character at a time.

Kestrel is a gentle yellow high-wing plane; Swift a responsive red biplane; Heron a broad-winged twin-engine tourer. Each has its own fixed parking identity, size and handling. The three aircraft stay on the actual island. Taxi, takeoff, bank, climb, approach, landing, stopping, parking and exit share one continuous pose.

The cedar-and-copper campus has a through-terminal, flight information, usable café and garden seats, terrace, ramp-accessed observation roof, open workshop hangar, planted promenade, apron and runway guidance. Doors, floors and ramp support use the same layout as their meshes. Classic, Taylor and Newfoundland have distinct materials and themed controls. Both Journey map renderers use shared airport coordinates with static simplified geometry.

The main road and all baked geometry are unchanged. The airport starts at the verified edge `(367.439,34.133,692.332)` and carries a raised approach through `(377.389,35.3,691.312)` and `(378,36,685)` to the court. An initial in-app drive exposed clearance against the terminal floor; moving the airport-side climb west fixed it. The revised actual-controller drive reached the court and dismounted.

## Controls and entry

Choose **Airport** in Horizon's Page selector, then **Walk**, or arrive from the main road. Walk beside any aircraft and choose **Fly** (or E). Taxi uses low power; align with the runway before choosing Flight and gently holding S. A/D turn, S climbs, W descends, brackets change power, X brakes on the ground, C cycles established views. The phone panel offers Taxi/Flight/Idle, power, stop, exit and parachute actions with the existing two pads.

E on the ground requires a stop. E airborne enters freefall; Space leaves and opens the existing parachute. No minimum height or airplane-only deployment sequence is added. Abandoned airborne aircraft become unavailable and stop simulating; explicit recovery at the arrival court returns the same identity to its stand if clear. Recovery never creates an extra aircraft. Reload resets motors and occupancy; a saved airborne aircraft becomes recoverable and the pilot returns safely on foot to the court.

## Verification log

- `node node_modules/vitest/vitest.mjs run test/horizon-airport-flight.test.ts test/horizon-airport-world.test.ts test/journey-land.test.ts --maxWorkers=1`: **42/42 passed**, 13.72 s. Actual baked geography supplies airport support and runway collision; the map remains **13 draws**, 12,635 full / 12,579 lite triangles.
- `scripts/horizon/airport-journey.ts`: scripted complete circuits use production physics, actual baked terrain and solids, shared south wind, and the two other parked aircraft. This is a model/world simulation, not a manual flight. Build with `node_modules/esbuild/bin/esbuild scripts/horizon/airport-journey.ts --bundle --platform=node --format=esm --outfile=/tmp/airport-flight-journey.mjs`, then `node /tmp/airport-flight-journey.mjs`. Result file defaults to `/tmp/airport-flight-journeys.json` (override `AIRPORT_REPORT`).
- Automated rendered Chrome, Metal, 1280×900: real runtime cruiser inputs drove road edge → approach → court, then dismounted. Inspector: 16.7 ms median / 16.8 ms p95 for that sample, 64 draws / 59,175 triangles. This is one local headless sample, not a device FPS promise.
- Automated Chrome, 1440×1000: Kestrel boarded, taxied from its own stand, took off, flew a circuit, approached, landed, taxied back and exited on foot. Used the existing development `simulateMotion` replay with actual runtime controllers and rendered departure/cockpit/parked captures. No pose resets within the flight. Zero browser page errors.
- Read-only independent final review: registry ownership, parachute velocity transfer, reload, comfort flow and map disposal inspected; no remaining concrete blockers reported.
- First unbounded-memory TypeScript invocation exhausted Node's default 2 GB heap. The repository's 6 GB invocation found tuple typing issues; fixed. Quick-gate retry also excludes the local dependency symlink from Git evidence and disables pnpm's automatic dependency reinstall. Dependencies were not reinstalled or changed.

- Final circuit script: **all three aircraft passed**, including ground return and a valid exit, with shared wind and the other two parked aircraft present.
- Additional mounted cruiser regression: actual baked-world drive into the airport **and back out**, 7/7 world tests passed. UI fixture updated for the new runtime API; 12/12 quick-layer tests passed. Storage stays at the existing runtime boundary via injected callbacks; 9/9 source fences passed.
- Night visitor replay: arrival → terminal → café seat → ramp → observation roof → ramp down → garden connector → promenade → workshop, all at the intended supported elevations. The route follows the actual connector at z656; walking across the unpaved gap at z652 is not the authored route. Zero page errors.
- Night Swift replay on a 390×844 touch viewport: taxi/departure → Space parachute → feet → explicit recovery → reload. Exactly three aircraft remained. Zero page errors. Separate actual Stage theme captures for Classic, Taylor and Newfoundland: all three boarded and no horizontal page overflow.
- `node node_modules/vite/bin/vite.js build`: **passed**, 3m04s. Existing PGlite/browser-external, eval and chunk-size warnings remain. This was the Vite client build, not the deployment command.
- Initial broad quick gate: **failed, time-budget-breached** at 367.3s. 486 tests passed / 8 failed: six old UI fixture failures, one storage boundary fence (both repaired above), one existing Journey model timing assertion during concurrent build load. TypeScript passed. A final gate follows the repairs; this earlier result is not reported as green.

### Final verification on implementation commit `e323e47df28470c935f462a91ce72e9429f06c57`

- `pnpm_config_verify_deps_before_run=false pnpm test -- --risk=high --focus=test/horizon-airport-flight.test.ts --focus=test/horizon-airport-world.test.ts --focus=test/horizonQuickLayerModes.test.ts --focus=test/journey-land.test.ts --focus-reason="Complete powered flight, road clearance, aircraft controls, shared island collision and map rendering budgets"`: **quick-gate-failed**, **196.8s, no time-budget breach**. TypeScript, AI surface and diff checks passed. 494 tests passed; the one failure was unchanged Journey model timing: 625.3ms versus 400ms. All **55 airport, road, map and aircraft UI tests passed**.
- `node node_modules/vitest/vitest.mjs run test/journey-board-model.test.ts --maxWorkers=1`: **42/42 passed**, warm derivation median **83.6ms**. The broad gate is still recorded as failed; this isolated result does not relabel it.
- Ran the gate's remaining serial file directly: `node node_modules/vitest/vitest.mjs run test/app-startup-p1.test.ts --maxWorkers=1 --testTimeout=30000`: **82 passed / 1 failed** (missing Bianca Month income Start button). The failing case also fails alone and reproduces identically against an untouched `git archive origin/main` source snapshot at **e77309e**, with the same dependencies. No Month or financial code was changed to mask this baseline failure.
- `node node_modules/vite/bin/vite.js build` repeated on **e323e47**: **passed**, **41.87s**, with existing external-module/eval/chunk-size warnings.
- Night Harley-style cruiser, rendered runtime inputs: road → court → road, every waypoint passed, then dismount. Day Vespa and night Harley share the existing cruiser physics.
- Axe 4.13 scan scoped to the new aircraft panel at 390×844, Newfoundland: **zero violations**. Keyboard `]` changed power to 10%; C switched to first person. Reduced-motion boarding opened the existing destination-cut interface. This is not a whole-app accessibility certification or physical screen-reader test.
- Main was refreshed after validation and remains **e77309e**; no airport/road integration conflict was introduced upstream.

## Evidence and limits

Local captures and diagnostics: `.codex-artifacts/horizon-airport/` in the workspace parent, outside the checkout. Includes `day.png`, `night.png`, `interior.png`, `night-interior.png`, `observation.png`, `road-connection.png`, `arrival-driven.png`, `aircraft-departure.png`, `cockpit.png`, `aircraft-parked.png`, and inspector JSON. These are actual rendered in-app views; no generated images.

The tower is an architectural landmark, not an accessible control room. No background traffic, booking, fuel economy, jobs, scores or minigames. Wind follows the current shared constant south-wind implementation; there is no independent airport weather engine. Physical iPhone/Mac handling, screen-reader use and authenticated full-app acceptance remain unverified. No claim of release readiness or deployed availability.

## Handoff

Next owner: Jonathan reviews the local airport and draft change. The implementation is complete; broader gate limitations and physical-device acceptance remain explicit. A later explicit release instruction is required to merge and deploy. Main-road coordination is unnecessary for the current geometry because no road-owned file is modified.
