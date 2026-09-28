# Hearth worksession — offshore fleet

- Status: OPEN, final project checks queued
- Opened: 2026-09-27 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex; bounded read-only movement and layout audits
- Repository: dual-ai-budget-app
- Branch: codex/offshore-fleet
- Baseline: 22c95b8b82cb3774f0b5f2aba6f562825aff6b0c (fresh main clone)
- Risk: High — shared movement, dynamic collision, airborne landing and restoration
- Environment impact: local recreational state only

## Outcome and scope

Implement the attached four-craft brief in the actual Horizon runtime: a tandem kayak, tender, fast motorboat and physically reached, walkable moving yacht. The yacht includes connected accommodation, service and operational spaces and stable galley station anchors for a future cooking game.

Budget delta (5): 0; preserve all ledger, identity, scope and Final Confirm owners.
Engagement delta (3): distinct water journeys and an explorable offshore destination.

The initial baseline had no implemented boats or swimming and only one orbit perspective. During implementation main advanced to `4685a6d` (#554, integrated parachute and shared camera perspectives); it was merged and its movement ownership retained. The shared wind source remains constant. Other active checkouts are not this branch. Keep one runtime movement owner, extend shared geography with dynamic providers, and reuse the existing flight landing query.

## Acceptance

- [x] Distinct frame-rate-independent handling; gentle contact and low-speed docking.
- [x] Physical boarding, local seats, secure return craft, swimming/ladders.
- [x] Rotating/translating deck support exactly once, stairs, walls, airborne arrivals.
- [x] Full yacht rooms and navigable galley work cycle; three authored material treatments.
- [x] Identity-scoped atomic fleet/support restore; no invented multiplayer.
- [ ] Focused tests, quick gate, build and actual runtime browser journeys recorded.

No recipe/scoring system, financial changes, schema application or deployment is in scope.

## Evidence and handoff

Integrated source checkpoint: `1f750f0` (base `4685a6d`), followed only by stronger retained control-proof assertions. Main's new parachute and C-perspective system is the sole airborne/camera owner; the fleet's old provisional perspective state was removed.

### Automated and browser proof

- `vitest run test/horizonFleet.test.ts test/horizonQuickLayerModes.test.ts test/horizonBoardLanding.test.ts test/horizonPerspective.test.ts test/horizonChute.test.ts test/horizonModeRegistry.test.ts test/horizonGliderController.test.ts test/horizonGliderLanding.test.ts test/horizonGliderReducedMotion.test.ts --maxWorkers=1`: **132/132 passed**, 9 files, 49.44 s after main integration. Final touch-focus regression: UI file **6/6 passed** again in 17.75 s.
- Scoped TypeScript passed after shared-airborne integration. Full final project gate/build results are recorded below when complete.
- Retained `node scripts/horizon/fleet-{journeys,walk,recovery,flight,visuals,controls,shore}.mjs` browser replays use Vite at 127.0.0.1:5198 and actual production movement/geography. Each has only a local starting-position fixture, then physical movement/actions. No household or financial fixtures. All returned without browser errors.
- Journeys: kayak, dinghy and motorboat each launch from the actual float dock, navigate around obstacles to the yacht, moor, board, return to the secured craft, travel back and step ashore.
- Interior: 15 named areas, all ten galley station approaches, all doors and three usable seats reached through connected walking/stair routes; 23,091 reachable sampled navigation nodes using character clearance. Pure navigation tests begin with doors closed and open them only from reach.
- Moving yacht: accelerate and turn, leave helm without resetting momentum, stand with local displacement under 1e-5 m, walk independently, jump using shared airborne physics, land back, walk to helm and anchor. Reload retains the supported local pose.
- Parachute: anchored upper-deck arrival; deployed-canopy arrival onto a yacht moving at **0.694 m/s**, followed by exact local deck carry and canopy gathering/removal. A closed-canopy fall onto a moving deck was also exercised during integration.
- Recovery: three repeated overboard swims and ladder climbs, plus actual south-shore swim→walk from `(858.45,-0.5,1486)` to `(858.45,0.071,1476.4)` without a shore fade. The shore replay starts via a validated saved tender, dismounts into water and asserts swimming before moving; a discarded direct restore fixture snapped to safe land and was not counted.
- Input/camera: held touch Brake maintains stage focus and braking while throttle is held (6.667→2.667 m/s in 1 s), releases outside the button; held Space does not redeploy after landing; first-person camera direction remains stable through yacht rotation and leaving the helm; C cycles all three perspectives.
- Rendering: desktop 1440×900 and phone viewport 390×844 for Classic, Taylor and Newfoundland; distinct computed palettes, in-bounds controls, first person and stable cutaways through jumps. Physical phone and screen-reader acceptance remain open.

### Earlier failures and limits

The first pre-integration High quick gate passed full TypeScript and AI-surface checks, but failed three UI tests because the fake runtime omitted fleet methods. That fake and a regression test were fixed. It also breached the 300 s budget (696.079 s; TypeScript 621.451 s) under concurrent compilation on this 8 GB host; this is not a passing timing gate. An initial build was deliberately stopped before merging main. A later gate was stopped to fix the touch Brake focus issue, and final project verification was queued behind the other task's full compiler. None of these interrupted attempts is counted as acceptance.

The legacy `horizonMoversNoMoney.test.ts` has two failures reproduced on clean baseline `22c95b8`: the `cameraMount` spelling triggers its money regex, and the existing flight registration file uses wall-clock APIs. No guard was weakened. The selected `horizonGliderNoMoney.test.ts` guard is separate.

### Implementation and next owner

The four new fleet modules own layout, model, art and registry adapter; Horizon runtime/geography supply dynamic support and shared activity integration; Stage/World/CSS supply nearby interactions and identity-scoped persistence. Tests and seven retained browser replay files accompany the [user/integration guide](../briefs/OFFSHORE_FLEET_GUIDE.md).

Local vessel state is device-local, not synchronized cloud multiplayer. Weather reuses the existing constant shared wind; calm/reduced-motion suppress ambient bob. Recipe systems are future work; beds, plumbing and engine internals are environmental detail. Final Confirm, books, Auth, schema, cloud continuity and financial writers are unchanged.

Next owner: Jonathan for visual review and physical iPhone/Mac, screen-reader and hosted acceptance. No deployment, schema application or Production change was authorized or performed. Local checks remain distinct from release acceptance.

### Final project verification

Pending the queued High quick gate and build; do not treat the focused tests as a full project pass.
