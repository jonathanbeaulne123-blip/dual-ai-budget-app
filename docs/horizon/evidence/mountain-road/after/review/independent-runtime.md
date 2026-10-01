# Independent bounded runtime review

Comparison: integrated main `1cf76c551e6f49124b6257162bc4d36ca18d7bd1` to checkout HEAD `df77030298d5ff960d2eeaa5eb62c8558008694b` plus working-tree changes present during this review. Read-only source/diff review; no source-world imports, runtime probes, browser, build, or tests executed.

## Result

No new actionable functional regression identified in the independently reviewed paths. This is a bounded code-review result, not movement, visual, frame-budget, or release acceptance.

## Independently reviewed

- `horizon/skate/world.ts`: translated visible support and ceiling queries; authored park precedence; missing support; material mapping; removal of the old native radial shore; external contact/submerged hooks; canStart checks.
- `horizon/skate/nativeSkate.ts`: hosted field/physics handoff, normal input driver preservation, current/next-position readiness hold, destination flush before current-position gate, drawing/camera translation and drawn-native foliage guard.
- `skate/driver.ts`: injected world field/physics; pending remote route, spot, marker and retry commands; input reset; cancellation and replacement; pause preservation; keyboard/gamepad respawn gate; unchanged standalone behavior without destination hook.
- `skate/sim/index.ts`: explicit absent support across ground/air/bail/wallride, short-sweep external collisions, safe marker/recovery checks, water bail/runout, and interaction with pre-existing standing/crouched ceiling handling.
- `runtime/index.ts`: destination chunk demand and region demand; ready gating before skate start/reset; scene-presence ownership before using region decks; existing body/camera handoff. Lighting was deliberately excluded.
- `runtime/geography.ts` and `regions/mountainV2/geography.ts`: travel-aware dynamic/static contact ordering, caller body height, upward/downward triangle roles, highest reachable drawn road support, same visible/felt ground ceiling, mouth deck preservation and whileDrawn gating. Foot/Ore repair-specific geometry was excluded.
- `mountain/surfaces.ts`, `branchLandings.ts`, `art/branchArt.ts`, `course.ts`, `roads.ts`: non-Dam-specific shared landing row consumption, consistent triangle diagonal, limits of explicit footprint, width-aware support placement and source-owned edge openings. The Dam entry helper I authored is NOT independently reviewed here, nor are generated landing coordinates physically revalidated.
- `body/bodyModel.ts`: supplied spawn height now reaches the existing obstacle-height filter.
- New `land/mountainV2/roadSource.ts`: lazy offline index reads the exported source; type-only native imports do not introduce eager native terrain work through the helper.

Read the existing `horizon-native-skate-world`, `horizon-native-skate-geometry`, and `skate-destination-readiness` tests to check intended contracts and whether the main seams had regression coverage. They explicitly cover no fabricated support, translated floors/ceilings, actual wall contacts, ducking, static walls after outward dynamic overlaps, dry support beyond the previous radial shore, queued destination cancellation/replacement and pause preservation. Their presence was verified; their current pass status was not.

## Boundaries and limitations

The src diff is confined to harbour movement/world geometry and Journey land extraction. No changed source under `src/core`, `src/cloud`, `src/auth`, `src/ledger`, `src/house`, or `src/App.tsx` was found against the comparison commit. The reviewed driver callbacks still expose skate progress/session state; this review found no new ledger, household, authentication, mutation/confirmation or financial-persistence path.

Excluded as requested: lighting; active Foot/Ore repairs; my authored Stillwater and Dam proposals, related furniture/planning work and previously reviewed metadata. No independent claim is made for those areas. Generated asset parity, all source landing coordinates, both-way real controllers, network failure timing, rendered deck/ceiling agreement and device behavior still depend on root's serialized evidence. No test failures were waived or reclassified in this review.
