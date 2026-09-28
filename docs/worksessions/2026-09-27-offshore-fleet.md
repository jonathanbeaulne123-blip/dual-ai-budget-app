# Hearth worksession — offshore fleet

- Status: CLOSED — local implementation and functional validation; timing and device/release acceptance remain open
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
- [x] Focused tests, quick gate, build and actual runtime browser journeys recorded (final timing requirement failed).

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

- Pre-responsive-fix source head: `cc5f16387beaf071936c8796127682c206fad4f0`; base `4685a6d05d3069ea1c600d476d3054ccb1235f35`; clean working tree at gate start.
- Exact command: `pnpm check:quick --risk=high --focus=test/horizonFleet.test.ts --focus=test/horizonQuickLayerModes.test.ts --focus=test/horizonPerspective.test.ts --focus-reason="Shared fleet, physical yacht traversal, airborne handoffs and camera controls"`.
- **PASS**, 108.058 s of 300 s, no timing breach. Full TypeScript 86.929 s; AI surface passed; test discovery 8.848 s; **297/297 tests in 22 files** passed. Change fingerprint `58268d6e06e624e0cce0125a97b2ceb8d3ea00d95dfa4d9d2dcb61241a24a362`.
- The preceding run failed at 482.996 s on two UI-fixture type errors (incomplete mocked HUD and untyped button query). These were corrected in `cc5f163`; the successful fresh run above supersedes that failure without hiding it.
- The following build passed mountain and Horizon asset checks, then was stopped before bundling to correct a phone overlay found during final screenshot review. The panel now observes the toolbar's actual height and stays 12 px below it; all three 390×844 theme captures and the added non-overlap assertion passed.
- Final executable source is `e9d5c36e35b784f968728d82322c8b3e1921db0e`. The gate started with only this worksession's documentation edits uncommitted (`workingTreeClean:false`); application/test code is committed. Its **full TypeScript and all 297 tests in 22 files passed**, but the gate took **784.330 s**, exceeding the 300 s requirement. TypeScript: 741.434 s; discovery: 15.238 s; tests: 26.597 s. Classification: `quick-gate-passed; time-budget-breached`. Fingerprint `61c482cadb661d3c73baa97f08c45b94b62ad3446f4c967809db70d8c590ad65`. The timing requirement is **not accepted**; the earlier 108.058 s result is not substituted for this final run.
- Build verification reuses the successful final full TypeScript result and the successful mountain/Horizon asset checks (the only subsequent executable changes were Stage/CSS and visual-proof assertions, with no asset inputs modified). The automatic `pnpm build` repeat was stopped before it repeated those checks. Remaining equivalent build stages are `pnpm typecheck:workspace && pnpm exec vite build && pnpm build:hercules-pro-ui && test ! -e dist/_redirects`; **all passed, exit 0**. Vite completed in 1 min 59 s. It emitted browser-externalization, eval and chunk-size warnings from the unchanged PGlite/geometry dependencies and larger app chunks. No dependency, ledger or build-policy edits were made to silence them.
- Go/no-go: **GO for local feature review; NO-GO for release acceptance** until the final gate's timing requirement and physical-device/hosted checks are addressed. This request did not authorize deployment or main-branch merge.
- Durable local evidence: `/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/artifacts/offshore-fleet/`. Full gate and focused logs, JSON journey results and screenshots are retained there. The final documentation-only closure commit does not change executable code.

## PR and merge follow-up

Jonathan subsequently requested “create pr and merge.” The implementation acceptance limits above remain disclosed; this follow-up authorizes the PR and merge work. Fresh main is `c82f9d7` (#556, explicit fall Retry). Its only direct Horizon overlap is the paired loader `fetch` to `prefetch` API rename; the Retry behavior belongs to the separate Harbour walker. The merge retains both decision entries. An independent read-only review found no concrete blocker in this integration, boarding/persistence, moving-deck carry or parachute recovery. Current-head verification and delivery results follow below.

The existing `.github/workflows/pages.yml` builds pull requests without deploying, and automatically deploys the Development build on main pushes. Production continuity stays off. No workflow or deployment settings were changed by the fleet work.

PR [#557](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/557) was opened and attached. The clean integrated head `a532dc1` passed full TypeScript and 443 tests across 25 files; its High quick gate took 305.338 s (5.338 s over budget, preserved as a timing miss). The GitHub PR CI passed in 118.152 s on the generated merge candidate `37e3bba`; the web build and both asset checks passed. Those results precede the review fixes below and do not certify the newer head.

Automated review found five valid regressions, now corrected: pedestrian water queries retain the underground Deep; small-craft contact uses oriented hull length/width and candidate heading; the speed readout refreshes while attached; appearance changes rebuild/dispose fleet art without resetting physics or occupancy; and unchanged/hidden fleet polls do not repeatedly commit React state. New regressions failed before the relevant fixes and the focused set passes **56/56 in four files**. The actual-runtime dock→yacht→dock replay passed all three small craft. All three theme/phone/desktop visual replays passed, including live appearance swaps with unchanged body/fleet state and disposal of old art. Final-head CI and verification are tracked in the PR.

GitHub records PR #557 merged externally at 2026-09-28 00:44:43 UTC as `eed2eaa`, from head `a532dc1`, before the automated review and fixes. The five review fixes therefore continue on `codex/offshore-fleet-review-fixes` directly above that merge. The correction keeps exactly the reviewed application/test content from `0d84344`; the original merged PR must not be described as including those later fixes.

The complete High quick gate on `0d84344` passed full TypeScript and **336 tests in 24 files**, taking **363.979 s** of the 300 s target (breach in discovery; TypeScript 292.603 s). Its application/test/script tree matches `3833059` exactly; only the delivery note differed. This remains source-equivalent evidence, not an assertion that the two commit IDs are identical. The subsequent stacked-water edge correction selects the nearest valid occupied surface when a deep overhead lake and underground pool overlap; its regression is included in the required final-head gate. The exact final commit, command, elapsed time, fingerprint and result are recorded in [PR #558](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/558) after completion, without changing the tested commit merely to embed its own hash.

While `e2e78c5` was being checked, main advanced to `c3019ab` (#555, scooter/motorcycle transport). That local check was interrupted because it no longer represented the final integration. The merge preserves cruiser movement ownership, safe saved-body handling, contact normals, camera clearance, top-control layout, and both live-theme paths alongside the fleet fixes. Geography retains both `contact` and `waterLevel`; Stage keeps guarded fleet polling and speed updates. Final combined browser proof and exact-head High/CI results are recorded in PR #558.
