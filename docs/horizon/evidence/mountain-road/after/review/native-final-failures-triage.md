# Native final failures: source-only triage

Checkout: mountain-road-book. Compared byte-for-byte with ../mountain-baseline-proof at integrated main 1cf76c551e6f49124b6257162bc4d36ca18d7bd1. No TS imports, test execution, world build, browser or checkout writes. Runtime inheritance is NOT confirmed by unchanged filenames or source alone; root's pending baseline replay is authoritative.

Source hashes and exact baseline equality: `/tmp/mountain-native-failure-source-proof.json`.

## Awning: unresolved current failure; exact diagnostic ready

Observed test: speed 8, bails 1, arrived true. This is a failed zero-bail test even though automatic sim recovery eventually satisfies the test's high-water route-index finish. Its assertion aborts before speed 12, so the suite supplies no speed-12 result.

`/tmp/mountain-awning-diagnostic.mjs` reproduces the original branch-finishing test's initial pose/kick, 8/12 speeds, max-index tracking, look-ahead, push/steer, zero air steering, 900-frame cap and 1/60 updates. It performs no subsequent state writes, respawns or manual recovery. The simulator's original automatic bail recovery remains present. It wraps sample/ceiling methods observationally (one original call, identical arguments/result), copies live/reused present/events, and records first bail reason/pose, last 90 frames, actual support and ceiling calls, source deck ceiling candidates, nearby full-tier island/park/soft blockers with the actual pushOutAll result, and ongoing route progress. At speed12 it explicitly labels an additional attempt that the original assertion did not reach. It records source hashes and git head.

Prepared but NOT RUN. Once given the slot:

    node /tmp/mountain-awning-diagnostic.mjs --root "/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book" --out /tmp/mountain-awning-current.json
    node /tmp/mountain-awning-diagnostic.mjs --root "/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-baseline-proof" --out /tmp/mountain-awning-baseline.json

Build products are isolated to a new /tmp directory. It imports actual source only WHEN EXECUTED; no reduced model substitutes for the controller.

Current course.ts:126–136 takes generated awning points/landingRows and new return/arrival; first nine source rows are intended to preserve entry+rail. That comment is intent, not yet a native runtime proof. Awning test itself is byte-identical to baseline. New worldDeckAt uses exact mesh triangles for landingRows, and support poles now follow their edges (surfaces.ts:54–65,112–117). These can affect the preserved entry's width/floor or the new return. Therefore source alone cannot classify the bail as old entry versus approved return.

The `!s.landingRows` condition also removes the older 18m open-junction ceiling exception (surfaces.ts:107). But native field calls unchanged `overheadAt`, which discards undersides less than 1.7m above feet, so this is NOT a demonstrated low-roof bail; actual ceiling reads must support any such attribution. No geometry/controller change proposed before first-bail evidence.

## Camera: definite fixture/render-hook mismatch; baseline replay pending

47/48 cases pass; only reduced-motion close-detail opacity fails, after birds successfully hide. `test/mountain-camera.test.ts:411` supplies `renderer.render: vi.fn()`. `mountain/streaming.ts:39–47` initializes streamed detail materials with opacity=0 and advances/restores their reduced-motion 300ms fade exclusively through mesh/line `onBeforeRender`. `setStreamQuiet` intentionally does not restore while reduced motion is active. Twenty fake RAF frames cannot execute a callback that the mocked renderer never invokes.

Test, streaming.ts and scene/runtime.ts are byte-identical to integrated main. This is strong concrete fixture evidence, not an executed baseline-pass/fail claim. Minimal future correction is a faithful renderer mock that invokes the render hooks for rendered detail, or a focused fade test explicitly exercising those hooks; do not remove opacity assertions or shorten/cancel the production fade merely to make this mock green. Consider visibility: a never-rendered hidden mesh may legitimately still be at initial opacity, so avoid claiming that enumerating all materials equals visible rendered output.

## Dressing: two observed failures, attribution still bounded

1. `mountain-descent seg14 @0.48` hits `dressing:tideline-hedge-+z-7`; seg15 @0.46 hits `dressing:bookends-hedge--z-2`.
   The test treats consecutive route gate centres as straight segments (`test/skate-int-dressing.test.ts:49–59`); mountain-descent route.points are MOUNTAIN_GATES centres (`course.ts:184`), not the intervening native road centreline. Thus it can report a hedge on a straight gate chord even if the physical curved route clears it. Verify these exact two segments on baseline and actual course before moving park dressing or changing road geometry.
2. Hedge approach minimum signed plan clearance is -0.135179m (expected >-0.02); no final crossing and final horizontal velocity zero assertions passed. Test collects minimum clearance over all phases/heights. Actual pushOutAll skips a solid if feet >= top-0.03 or the entire 1.25m body is below its bottom (`skate/sim/geometry.ts:129–131`). A height-aware collider cannot be convicted by plan penetration alone; first penetration pose/phase/feet-versus-top is needed. This does not prove the test wrong or authorize tolerance changes.

Dressing build/solids, park layout, collision geometry and tuning are byte-identical to baseline. Native mountain roadLine source is also identical; roads.ts changes openings, not the route XY. Course/branch/surface changes and engine optional support handling remain in the dependency graph, so baseline execution is still required.

## Feel: concrete unchanged native sampler cutoff crosses the park

Three failures: Breadbin generates one rather than >30 peaks; Hatch ollie apex relative to lip -0.465748m; Hatch 360-flip never caught (pop,bail,recovered). Hob and lab-line tests pass.

`skate/world/field.ts:401` unconditionally chooses native worldSample if z<-40, before querying authored park features. This exact existing branch is unchanged from main; current field.ts changes only add samplePark and a core return value. Tideline's unchanged frame is [18.6,-38.3], yaw150° (`world/layout.ts:55–56`). Pure coordinate arithmetic gives:

- Hatch spawn local[11,2.5] -> world[10.323721,-45.965064].
- Hatch intended pop local[5.75,2.5] -> world[14.870354,-43.340064].
- Breadbin centre local[-9,6.4] -> [29.594229,-39.342563]; toward its +X wall, local[-6,6.4] -> [26.996152,-40.842563].

Therefore Hatch and one Breadbin end are routed into world terrain instead of their park feature sampler. This is a specific baseline-source mechanism consistent with the observed failures; no baseline runtime result is claimed. The optional supported flag is omitted by normal native samples and treats finite native samples as supported, and native tests supply neither Horizon contact nor submerged callbacks. Do not retune gravity/pump/pop/steering to compensate for an incorrectly selected surface. If baseline reproduces, assign an independent native field-selection repair with proper pad/feature ownership rather than silently hiding these failures in this Mountain work.

## Suggested serial validation order

Root's existing four-file baseline replay first; then current and baseline exact awning runner. Compare first-bail projected segment, actual support/ceiling/obstacle witness, and exact first-nine branch points. Preserve all original test inputs and thresholds. Only the observed failing portion should guide a bounded fix; pending native frame/awning entry choices remain unapproved.

## Additional observed regression: harbour-skate-model ninth route witness

Baseline replay logs now confirm 8 collision witnesses versus current 9. The added row is only `full:mountain-descent:9`, from native[7.715598107341353,-191.3168118322227] to [88.67828044808631,-162.32254217463523]. This is not classified as inherited.

Current v2-data SHA418eab3afb34746b1341d6f80c16efc7d6921eb71ad301e31e249b63b46cab8f identifies full native tree52 at [66.518987,33.3865,-170.245374], round,size0.839368322, collider radius0.184661031. Tree centre is0.012079532m from that straight gate chord. It is7.320898702m from the actual941-row road centreline and2.521048889m outside the union of its actual source-normal/halfwidth road quad strips, giving2.336387859m trunk clearance and2.061387859m including BODY_RADIUS+PATH_CLEARANCE. Nearest road halfwidth is4.8m. Library branch centreline is5.870739125m away.

Pure JSON artifact: `/tmp/mountain-ninth-route-witness.json` and derivation script `/tmp/mountain-ninth-route-witness.py` (the appended sweep calculation is recorded in JSON's method; no TS executed). This current dump may predate some subsequently applied changes, and the failing test log does not name its obstacle. The exact awning runner now also emits `ninthRouteWitness.blockers` by applying the actual pathSegmentClear to every full-tier obstacle, so baseline/current runs will identify the precise live collider with no inference.

Source mechanism: mountain/planting.ts:34 derives keepouts from current SKILL_BRANCHES; tryTree:92–101 consumes random numbers after acceptance, so a changed branch footprint can alter RNG sequence and occupancy, cascading forest/flower/tuft positions outside the repair. Planting source itself need not change. modes_probe is reviewing baseline-authored generation plus selective postfiltering of only real new landing conflicts. Preserving scenery must not become wholesale forest reseeding. Conversely, do not move/delete this off-road tree solely to clear an artificial straight gate chord; prove actual route and finite-width conflicts first.
