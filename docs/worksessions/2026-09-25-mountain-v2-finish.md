# Hearth Mountain v2 finishing

Status: implementation delivered within Jonathan's preservation scope; release acceptance OPEN. Owner: Jonathan. Assignee: Codex. Risk: High (world geometry, motion, ephemeral presence compatibility).

## Request and provenance

Jonathan: “finish claudes work do not change what he has already done.” Attached instructions are handoff evidence, subordinate to that request and repository authority. Optional redesign is excluded.

Verified bundle head `9901a5073eac28e0da541131c6e20d7fc2d5fd75`, base `2d9c21923c261ae14914eee3b1cbf908d3ec2fe7`; all 48 original commits are retained as ancestors. Main `f243758d1bdf44237ba54d919d928d925de1a0ba` adds the monorail and is also an ancestor. Work is isolated on `codex/mountain-v2-finish`, in `.codex-work/mountain-v2-finish`; the original checkout and supplied package are untouched.

Implementation commits: `bbf9af89` (integration and finishing), `f68776af` (safe plinth collision/test signature repair), `0267fc63` (focus-test settling). `pnpm build` passed on clean `0267fc63`. Subsequent handoff edits are documentation only.

Budget delta (5): preserve accepted Fund evidence, personal/household scope and Final Confirm. No financial posting changes.
Engagement delta (3): finish motion, accessibility, retry, streaming, transport and compatibility while retaining Claude's geography, camera direction and three art treatments.

## Delivered

- Reduced motion applies to newly streamed detail and to an already-running scene; active fades settle and flying birds hide. Detail builds one district per update and retains departed districts for four seconds; tool use keeps the walking radius.
- Terrain and guide-map outputs are precomputed exactly, with retained authoring algorithms and a reproducible generator. The walk graph is cached and warmed before readiness. Collision, route-neighbour and foliage work is indexed/cached.
- Retry is consumed during countdown and resets behind gate zero. Awning clearance follows the existing terrain while retaining its original route and width; full-tier simulated entries at 8 and 12 units/second complete without bailing.
- Ride offers withdraw on movement/arrival/place changes, announce themselves and accept keyboard input with focus returned to the stage. Interrupted transport parks safely. Explicit views/skating release monorail ownership. Run survives body recreation; Q/E track independent keys and clear on blur.
- Camera blockers follow the authored dam and transport structures; the gorge reveal uses the gondola spline. Summit framing is raised. Authored decal/wax meshes render. The phone ride offer is moved above the controls.
- Browser presence advertises `hearth-mountain-2`. Shared Worker decoding accepts either mountain version without erasing it; incompatible positions are hidden while membership remains. Saved v1 returns retain migration. Browser and Worker compatibility tests exercise the real contract.
- Main's island monorail remains available with its stops and controls; Claude's original funicular/gondola geometry remains intact.

Primary changed areas: `src/harbour/mountain/`, `scene/runtime.ts`, `HarbourWorld.tsx`, `body/geography.ts`, `body/obstacles.ts`, camera adapters/poses, `art/cardScene.ts`, skate driver/field, house navigation and the ephemeral world-presence modules. No persistent ledger writer, Auth policy or schema changed.

## Preservation decision: dam abutments

The attached request to add solid abutment body walls conflicts with the existing maintenance shortcut. Independent exact rotated-box sampling found **124 core/cap overlaps among 2,535 full-width branch samples**, all on `dam-promenade`; 109 had centres inside the stone footprint. Example: world `(34.187975,89.582398,-240.186965)`, local `(3.355533,3.764115)`, inside core half-extents `(3.5,4.5)` below top 90. This is not merely an enclosing-box artifact.

The lower plinth has zero overlaps and is now solid. Abutment camera protection is repaired, but body walls there remain deferred. An authored opening or reroute would change Claude's completed work and needs a later design decision. No collision exemption was silently invented.

## Verification

All commands use the bundled Node runtime on PATH.

- `node scripts/generate-mountain-data.mjs --check`: PASS, exact terrain/map equality, revision `hearth-mountain-geo-2`, two 147,167-sample grids.
- Supplied 21-suite test list plus five finishing/monorail suites: initial run 467/470 assertions passed; two streaming expectations and the newly introduced abutment collision failed. Streaming expectations were updated to the intended delay/incremental behavior and unsafe body walls removed. The affected suites were rerun.
- `pnpm exec vitest run test/hearth-mountain.test.ts test/mountain-camera.test.ts test/mountain-finishing.test.ts --maxWorkers=1`: PASS, 57.80s (90 assertions in that run, including a subsequently removed redundant plinth-membership assertion). The substantive final suites contain 37 world, 48 camera and 5 finishing tests.
- `pnpm exec vitest run test/mountain-branch-finishing.test.ts --maxWorkers=1`: PASS; original-width awning at both tested speeds. Full descent simulation: 94.35 seconds, 17/17 gates, zero bails.
- `pnpm exec vitest run test/harbour-walk-focus.test.ts --maxWorkers=1`: PASS, 25 tests, 8.58s after waiting for the initial deferred focus attempt before intentional blur.
- Independent read-only audits covered compatibility, camera solids, reduced-motion synchronization and transport ownership; the reported concrete integration defects were corrected.
- `pnpm build`: PASS, exit 0 on `0267fc63`; includes application TypeScript, Worker TypeScript, Vite, Hercules UI and the no-redirect-file check. Vite transformed 1,461 modules in 52.46s. Existing dependency external/eval, mixed import and large-chunk notices remain.

The High gate command was:

```sh
pnpm test -- --risk=high \
  --focus=test/hearth-mountain.test.ts \
  --focus=test/mountain-movement.test.ts \
  --focus=test/mountain-camera.test.ts \
  --focus=test/mountain-finishing.test.ts \
  --focus=test/mountain-branch-finishing.test.ts \
  --focus=test/world-presence-lane.test.ts \
  --focus-reason='Mountain v2 finishing preserves authored geography and verifies movement, camera, motion, transport and presence continuity'
```

**High gate: FAIL, not release evidence.** Clean `f68776af`, 368.853 seconds, over the 300-second budget. TypeScript passed in 215.899s. Fast phase: 514/518 assertions passed, 30/32 files passed; three old `harbour-open-world` assertions still require mountain destinations to use the island grid/30-second stroll. The fourth failure was the focus-test settling race, repaired and independently rerun above. There was also a worker `onTaskUpdate` timeout. The gate did not reach its two serial suites. No broad pass is inferred from targeted repairs. A prior `bbf9af89` gate failed on two missing test arguments; those were fixed. Resource-starved or interrupted runs are not passes.

## Browser and remaining acceptance

The fictional local review harness was used, without hosted activation. Classic reading edition at 390×844 loaded with zero uncaught errors and a captured screenshot. The native in-app browser rendered the Classic mountain, opened the guide with all six districts, visited Summit Commons, and navigated the six tour cards. This is limited visual/interaction proof, not a complete tour-framing or movement acceptance run. The harness was stopped afterward; its retained page showed connection errors once the local server was stopped.

Software-rendered 3D screenshot/ready attempts timed out and are not passes. Full desktop/phone three-theme visual acceptance, actual ride-offer overlap screenshots, real Mac/iPhone movement/race performance, VoiceOver, audio/controller feel, two-device authenticated presence and the complete supplied acceptance sequence remain OPEN. The source has the three authored treatments; automated art/landscape tests cover each, but they do not replace those device checks.

Logs and the phone reading screenshot are saved beside the worktree in `../mountain-v2-finish-evidence/`. No push, merge, deployment, hosted schema, credentials, Production or household mutation occurred. The local review server and temporary browser were stopped/closed.

Next owner: Jonathan for preservation-sensitive dam design and physical acceptance; implementation reviewer for the remaining legacy test contract and a High gate within budget. This branch is reviewable locally, not approved for release.
