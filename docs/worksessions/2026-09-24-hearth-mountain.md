# Hearth Mountain implementation

- Status: OPEN; local implementation, no release authorization.
- Owner: Jonathan. Branch: `codex/hearth-mountain`.
- Baseline: `87f6027098f07cb39482f5f7e13cc652df166c81` (Skate Club v2 merged).
- Risk: High: shared geometry, navigation, recreation, presence and financial presentation.
- Budget delta (5): clearer existing Fund interpretation and destination access, unchanged posting authority.
- Engagement delta (3): a connected mountain neighbourhood, transport and timed descent.

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
- Rendering: instanced plants and spatially batched rails/supports. These are optimizations,
  not proof of the planned landscape/exterior streaming or physical-phone performance.

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
streaming, ambient audio, investor rehearsal, physical-device accessibility/performance,
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
