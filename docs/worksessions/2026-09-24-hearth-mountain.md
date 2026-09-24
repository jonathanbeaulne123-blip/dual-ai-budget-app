# Hearth Mountain implementation

- Status: OPEN; local implementation, no release authorization.
- Owner: Jonathan. Branch: `codex/hearth-mountain`.
- Baseline: `87f6027098f07cb39482f5f7e13cc652df166c81` (Skate Club v2 merged).
- Risk: High: shared geometry, navigation, recreation, presence and financial presentation.
- Budget delta (5): clearer existing Fund interpretation and destination access, unchanged posting authority.
- Engagement delta (3): a connected mountain neighbourhood, transport and timed descent.

## Parallel continuation

Jonathan requested parallel completion after the initial local handoff. Three isolated
implementation worktrees start at `a81e43ad034bdec64ebbf6b834add234a68fd64e`; root integrates
and owns demo/acceptance tooling. See [parallel packet](../briefs/2026-09-24-hearth-mountain-parallel.md).
Heavy checks remain sequential because of observed host memory pressure. Physical
acceptance hardware: iPhone plus this Mac; controller availability is not established.

## Authorized outcome

Implement the approved Hearth Mountain plan: six inhabited districts, three reserved plots, town square, winding road and footpaths, funicular and gondola, glass Fund basin, living scenery and Summit to Sea race in all three themes. Preserve canonical rooms, creative selections, commands, accepted books and Final Confirm. No schema, household-data mutation, merge or deployment.

## Dependency order

World definition and layered surfaces → playable terrain and course → movement/camera/return/presence → inhabited districts and transport → supported Fund reading and ecological presentation → theme/accessibility/performance verification.

## Acceptance register

- [ ] Layered ground, road, bridge and balcony queries; height-aware collision/camera/gates.
- [ ] Continuous destination access, body return, transport and retained creative state.
- [ ] Accepted Fund projection, freshness, internal/external flow distinction and no repeat animation.
- [ ] Three themes; reduced motion; readable non-WebGL navigation.
- [x] Focused tests, TypeScript, build and High quick gate on the integrated local source snapshot.
- [ ] Browser walkthrough and visual evidence.
- [ ] Physical phone/controller timing, sustained performance and opted-in two-device ride.

## Evidence

Initial source audit verified current remote main and clean predecessor checkout; isolated new checkout. Physical-device and authenticated cross-device acceptance remain explicitly separate from automated or local browser results.

## Implemented scope

- `src/harbour/mountain/`: authored geography, reserved plots, terrain/support/collision
  definitions, transport alignments, glass Fund basin, read-only projection adapter,
  guide, local race course and three-theme scenery.
- Existing village room placement and navigation: moved Home, Library, Glasshouse and
  cottage; retained IDs, contents and tool routes. Town storefronts open existing tools.
- Body/skating/cameras: layered support, absolute elevation, bounded obstacle volumes,
  overhead deck clearance, underpass mount/dismount, elevation-preserving recovery,
  expanded overview bounds, safe room camera containment and ride cancellation on entry.
- Persistence/presence: versioned elevated return records, deliberate legacy migration,
  matching Worker forwarding, and incompatible positions withheld without hiding peer membership.
- Rendering: instanced plants, spatially batched rails/supports, releasable close district
  detail and building exteriors, retained distant silhouettes and reusable terrain lattices.
  These are not proof of physical-phone performance.

## Verification history

- Original integrated gate: failed and exceeded its five-minute budget; 1,705.457 seconds
  total, 1,694.356 seconds in TypeScript. Reported a cabin `window` shadowing error in
  the earlier source snapshot. The cabin is now an open frame and that binding is gone.
- Subsequent TypeScript check found an incorrect test fixture property; corrected to
  the actual SkateDriverWorld contract. Later TypeScript phases passed in 52.0 and 46.8 seconds.
- Wider fast regression: 81 files / 741 tests passed. Serial regression: 197 passed,
  one room-camera containment failure. The migrated room target now clamps into the
  eye/target volume intersection; focused camera/walk tests subsequently passed.
- A newly added underside-collision test exposed low shortcut decks over the main road.
  The branch geometry now gains clearance above the road while its mouths remain
  open junctions. The final mountain suite passes all 14 tests, including full-width
  branch support, transport clearance, wrong-height/direction gates, reconnect cursors,
  underpass mounting, marker elevation and bridge underside collision.
- Final deterministic descent: **74.4667 seconds, 0 bails, 22/22 ordered gates**.
  The authored mountain road measures 890.0 units. Actual v2 physics, input steering,
  building obstacles and shoreline constraints are included. This is not human timing proof.
- Read-only independent audit supplied specific navigation, transport, support and
  shortcut defects; Codex applied the fixes in this checkout. No parallel writer.

## Reproduction

The host's bundled Node runtime was used, with
`pnpm_config_verify_deps_before_run=false` to preserve the existing shared dependency
installation. The current source validation command is:

```sh
pnpm test -- --risk=high \
  --focus=test/hearth-mountain.test.ts \
  --focus=test/world-presence-lane.test.ts \
  --focus=test/world-presence-worker.test.ts \
  --focus=test/whole-house-navigation.test.ts \
  --focus=test/harbour-reading.test.ts \
  --focus-reason="Mountain geometry, overhead clearance, full descent, transport, accepted water and versioned browser/Worker continuity"
pnpm build
```

The gate discovers relevant existing tests; this is not the separately authorized exhaustive gate.
Current run logs: `/tmp/hearth-mountain-release-check.log` and `/tmp/hearth-mountain-build.log`.

## Review and remaining ownership

[Local review guide](../briefs/2026-09-24-hearth-mountain-local-review.md) records the
fictional preview, programme gaps and acceptance boundaries. Status remains OPEN for
the overall approved programme. The playable foundation does not mean final art,
full visual acceptance, investor rehearsal, physical-device accessibility/performance,
controller timing, or live two-device acceptance is complete. Jonathan owns play-feel
and visual acceptance; Codex retains integration and evidence ownership. No merge,
deployment, schema application or hosted household mutation is authorized or performed.

## Integrated foundation gate

The final foundation High quick gate passed in 279.891 seconds against source fingerprint
`1c762c199c4e5bb27919c6814315457c9250741219090391c2c1ea1c26c56c04`:
81 fast files / 742 tests plus 7 serial files / 198 tests (940 total), TypeScript 58.355 seconds.
No time-budget breach. Application build passed in 54.12 seconds with the existing
large-chunk advisory. This is local change-focused evidence, not release acceptance.

At 390 × 844, the guide and destination list were usable. Entering Library during a
funicular ride cleared the ride; opening Standing Book and returning preserved exact
elevated body coordinates. The reading edition exposed all six working destinations
and three reserved-place explanations without requiring WebGL. Desktop overview and
fictional CAD 7,600 Fund inspector rendered. Viewport overrides were restored.

## District detail and sound increment

- Added releasable district detail and authored exterior ownership with a 24-unit release
  band. Base landscape and cheap building silhouettes remain resident. The race pins
  the complete detail corridor during countdown and the run; ending/dismounting releases it.
- Added orchard/birch clusters, flower islands, beds, benches, lanterns and summit telescope.
  Cliff colouring now reads slope and district. A shared seeded forest plan supplies
  rendered trees, trunk obstacles and camera foliage volumes; arrivals and paths stay clear.
- Added gesture-enabled original wind/water/leaves and footstep synthesis. Device Sound
  can mute/dispose it; tools, hidden pages and calm scenery silence it. No audio downloads.
- Calm presentation survives renderer/theme rebuilds and honours Quiet expression.
  The accepted CAD reading and scale have separate dam labels for legibility.

Verification: the expanded High gate passed in **249.516 seconds**, without a budget
breach: 81 fast files / 744 tests and 7 serial files / 198 tests (**942 total**).
TypeScript took 67.391 seconds. Gate source fingerprint:
`7e90c2603bfdce6fcc6864b5a471543912370ba43d8b1d8b6cb2cf7e7c44efc2`.
The subsequent presentation-only calm retention and dam-label adjustment are included
in the final build and its TypeScript run, with follow-up UI verification recorded below.

A direct `pnpm exec tsc --noEmit` attempt exhausted Node's default 2 GB heap; it did not
use the repository's 6 GB typecheck script and is not a pass. A simultaneous focused
run had 100 passing tests but one test-runner RPC timeout and exited 1; also not a pass.
The normal gate subsequently passed. Browser control timeouts during host load were
resolved by inspecting actual state and using the accessibility interface.

Three-theme checks showed Taylor's guide and glass dam, Newfoundland's full mountain,
and Classic's orchard close view. The original Classic preference was restored. These
are targeted browser observations, not complete visual or physical-device acceptance.

## Final review fixes and browser follow-up

A bounded read-only review of the detail increment found three lifecycle defects. Calm
now applies to the resident Court even when selected indoors, and every newly raised
Court inherits it. Audio pauses when the shared renderer is suspended or its context
is lost. Changing household/member detaches the old audio and resets its control.
No concrete exterior ownership/cutaway defect was found in that review.

In the final browser follow-up, enabling calm in Library and returning to its outdoor
plateau retained the checked control. World sounds toggled on and back off; audio mix
quality was not auditioned. Starting Summit to Sea displayed the actual countdown and
next gate; B returned to walking cleanly. The captured browser error list was empty.
Classic, Sound off and normal scenery were restored. This is not a completed manual race.

The post-review gate (`/tmp/hearth-mountain-reviewed-gate.log`) failed in **723.199 seconds**:
TypeScript passed in 514.141 seconds, but two scene-mount checks exceeded their 15-second
timeouts and the runner reported two RPC errors. That run is failed and time-budget-breached;
the earlier passing run does not replace it. Its chained build did not run.

## Terrain reuse and final integrated source

The timeout investigation removed repeated immutable terrain generation across scene/theme
rebuilds and expensive empty-cell expansion for distant route queries. Geometry, physics
and course lengths are unchanged. Cached positions are read-only, bounded by render tier;
GPU geometry and disposal remain scene-owned. A bounded independent source review found
no actionable correctness or ownership regression in these two optimisations.

Focused verification (`/tmp/hearth-mountain-terrain-cache.log`) passed **103 tests** across
mountain, body and world-frame files in 20.35 seconds. The two previously timed-out checks
took 801 ms and 817 ms. Descent remained **74.4667 seconds, 0 bails, 22/22 gates**.

Final High gate (`/tmp/hearth-mountain-cached-gate.log`) passed every assertion: **88 files,
942 tests** (744 fast and 198 serial), with TypeScript 164.227 seconds. Total **630.548 seconds**;
classification **quick-gate-passed; time-budget-breached**. This is not a within-budget pass.
Source fingerprint `7aeb343d29e861f0c40c52933b8aa6821e29931b15caf4c0e42bd61c46b38927`.
The ordinary build wrapper (`/tmp/hearth-mountain-cached-build.log`) was deliberately
interrupted during its duplicate application type-check after that same source had
passed the High gate. This interrupted invocation is not a build pass. To avoid repeating
the identical expensive check under host memory pressure, the remaining build components
were run separately with unchanged application source:

```sh
pnpm typecheck:workspace
pnpm exec vite build
pnpm build:hercules-pro-ui
test ! -e dist/_redirects
```

Their combined log is `/tmp/hearth-mountain-bundle.log`. The application type-check evidence
for this build is the final High gate above; documentation was the only later edit.

All remaining build components passed (exit 0); Vite completed in **1 minute 35 seconds**.
Existing dependency browser-external/eval notices and the large-chunk advisory remain.
No physical-device performance claim follows from this build.

## Final visual correction

The post-build browser review showed that wide dam plaques were too shallow: fixed
texture padding reduced their letters to the minimum size. The final source change
gives wide mountain signs a 4:1 aspect and separates the two dam labels vertically.
Browser inspection then read **Fund $7,600.00 CAD** and **Scale $13,400.00 CAD** on the
dam face. The guide also showed the supported balance, reserves, free amount and date;
the overview remained complete and the captured browser error list was empty.

This small presentation change follows the 942-test gate. The focused mountain suite
passed again: **16 tests**, 18.49 seconds, unchanged 74.4667-second descent. Its log is
`/tmp/hearth-mountain-label-test.log`. The bundle is rebuilt after the sign correction
in `/tmp/hearth-mountain-label-bundle.log`; the prior broad gate is not represented as
an exact fingerprint of these later presentation constants.

The final bundle, Hercules UI build and redirect assertion all passed (exit 0). Vite
reported **5 minutes** under host resource pressure, with the same existing dependency
and large-chunk notices. No further application source changes followed this build.

## Parallel implementation and integrated review, 2026-09-24

Three isolated implementation branches were integrated, followed by read-only cross-review.
The slices added authored district art and distant silhouettes, stations and distinct cabins,
shared town-channel terrain, observed recovery and repair persistence, garden/bench/bell/
overlook/wildlife interactions, local race recording and ghost/replay, controller pause polling,
a manual neighbourhood tour, and a loopback fictional rehearsal with frame measurements.
Room IDs, saved creative selections, accepted financial authority and deployment scope remain unchanged.

Integration review found and repaired a recovery render loop, cached-reading freshness handling,
stale anchor closures, stranded cabin cancellation, controller replay pause/resume, a storage
boundary violation, and Fund links opening the Queen scene instead of the existing contribution
review. The Fund shortcut now opens the existing Standing Book Contributions division.

Browser evidence on the Mac's Codex browser, fictional loopback household
`HH-MOUNTAIN-GROWING-review-sept24`:

- Existing receipt review and Confirm received accepted a synthetic $250 contribution:
  shared revision 0 → 1; operating $7,600 → $7,850; the dam independently displayed $7,850.
- Open/close Kitchen garden gate updated the readable action and feedback.
- Gondola boarding and skip completed; world return diagnostics showed y=110 near summit.
- Summit race showed countdown, Restart race, ordered-gate HUD and pause book; this was
  not a clean human timed run and did not create a completed ghost recording.
- Reading edition retained every destination and reserved-plot explanation. Calm checkbox
  toggled without a renderer. This is an accessibility smoke, not a VoiceOver walkthrough.
- Manual capture start/stop produced percentile and resource fields. A stationary smoke
  during concurrent build load measured 12.2 painted fps, p50/p95/p99 54.2/110.4/1141.8ms,
  362→362 geometries and 36→36 textures. It is explicitly NOT traversal/device acceptance;
  it neither establishes 30fps nor GPU-byte stability. The selector was corrected to the
  actual canvas host after the first click correctly refused a missing runtime.

Initial integrated quick gate at `bfd784b4` failed: 321/324 tests passed, one source storage
fence failure and two 30s demo-fixture timeouts; TypeScript passed in 182.4s. Total 308.600s,
so the five-minute budget was breached. Fixed storage by injecting it from the existing shell.
Full ledger fixture assertions get 60s each; the overall gate budget stays unchanged.
Focused repair validation: 4 files / 27 tests passed in 54.45s, including both demo chapters,
storage fences, frozen recovery and controller-only pause polling. The demo test explicitly
models the authority's accepted revision after the ordinary contribution command.

The second broad High gate at `2f8c0b48` also failed: TypeScript passed in 260.089s;
test discovery took 134.080s; the fast phase passed 59 files / 596 tests and failed
two tests (598 total). Total time was 609.150s, a five-minute budget breach. The
weathered demo fixture exceeded 60s while competing with four workers, although
both chapters had passed in the isolated repair run. The fixture now runs in the
existing isolated serial lane, with no further timeout increase. The older bank
acknowledgement test reloaded after submission but before its fixture had accepted
the receipt, incorrectly simulating an unaccepted command as a lost acceptance.
It now waits for the accepted receipt before each reload; production authority is
unchanged. This is not represented as a passing broad gate. Logs:
`/tmp/hearth-mountain-parallel-final-gate.log` and
`/tmp/hearth-mountain-integration-fixes.log`.

The remaining selected serial suite completed: **8 files / 207 tests passed;
1 file / 2 tests failed**, 682.41s total. Startup (83), walking (81), actual App v2
shared-authority browser (1), acknowledgement recovery (6), workspace browser (6),
Plan (19), financial proof matrix (7) and workspace merge review (4) passed.
Both tests in `hearthside-actual-app-browser.test.ts` timed out at their existing
180s/120s limits. The current stage marker reached `legacy-deep-links`, but no
current failure capture identified a cause. Its other browser artifacts were stale
and belong to another checkout; they are not evidence for this run. These failures
remain unresolved, not classified as a confirmed infrastructure issue. Log:
`/tmp/hearth-mountain-parallel-serial.log`.

After the receipt-wait and isolated-lane changes, **3 files / 28 tests passed in
16.52s**: bank journey (9), verification policy (18) and test-lane routing (1).
Log: `/tmp/hearth-mountain-final-repairs.log`. The broad gate has not been reclassified
or silently replaced by these targeted passes.

Final bundle verification passed (exit 0): `pnpm typecheck:workspace`,
`pnpm exec vite build`, `pnpm build:hercules-pro-ui`, and `test ! -e dist/_redirects`.
Vite transformed 1,382 modules and completed in **2m 10s**. Existing dependency
browser-external/eval, mixed static/dynamic import and large-chunk notices remain.
Application TypeScript is the successful 260.089s pass above; later executable edits
are the tested runner/test changes and the browser-verified capture-host selector.
This was the component build sequence, not a fresh `pnpm build` or passing broad gate.
No production source changed after this bundle. Terminal execution session: 55731.
Phone, human race/shortcuts, two-device presence, final art/lighting/camera direction,
audio mix, full VoiceOver and real GPU memory remain open in the
[iPhone/Mac checklist](../reviews/2026-09-24-mountain-iphone-mac.md). The local URL is loopback
only; no test-host exposure, push, merge, deployment, schema application or October security
acceptance has occurred.
