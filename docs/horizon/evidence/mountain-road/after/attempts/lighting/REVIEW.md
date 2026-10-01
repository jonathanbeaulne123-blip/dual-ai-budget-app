# Mountain safety lighting — bounded source proposal

Patch: `/tmp/mountain-light-gap.patch`. Checkout was never edited. Geometry slot released.

The final served baseline remains evidence: 52 planned full / 31 planned lite lamps; seven road targets beyond 12 m, plus one apparent road-only garden gap. No failed report was rewritten.

The source proposal adds optional exact safety targets to the existing lamp planner. Mountain passes its existing bend, opening and endpoint lane targets. The final repair phase searches actual supported legal sites near each still-uncovered target, retaining existing mouth, stop, occupancy, water and support rules. A new road lamp requires the existing whole-footprint setback measurement; it cannot fall back to an assumed guard on a batter. A new bridge lamp requires an existing guarded structure side and avoids the sea side. Failure to find support fails the plan explicitly.

The shadow replay added exactly three coverage fixtures:

| Site | Kind | Base (Horizon x,y,z) | Physical support |
|---|---|---|---|
| Reservoir approach bend | Existing bridge lantern kit | 1284.990, 123.411, 548.295 | Native `mountain-road:right:bridge:619`, plan distance 0.000419 m from actual source guard line; base 0.15067 m above line's deck level, within the existing 1.1 m guard |
| Alpine bend | Existing road lantern kit | 1397.255, 150.955, 488.612 | Dry clear 0.4 m footprint, maximum ground delta 0.014666 m |
| Summit arrival | Existing road lantern kit | 1328.670, 158.107, 465.285 | Dry clear 0.4 m footprint, maximum ground delta 0.010168 m |

The garden already has the runtime stop fixture at [1364.373352,89,590.133238], 1.903731 m from its stop centre. The planner's lite cover now credits the exact `stopLayout` fixture and exact runtime eligibility condition. Runtime-art regression checks the actual fallback anchor in every theme/tier; no legacy threshold/bead anchor counts as a lantern.

Lite selection uses strict actual pool radii. It no longer treats nearest full-tier distance as an enlarged acceptance radius. A deterministic reverse removal pass removes redundant road-lamp selections only when every required target remains covered; all non-road fixtures remain mandatory. Authored lamp geometry and the six/two dynamic point-light pool are unchanged.

## Measurements

Input world SHA256: `6dcdae3f1c484bac779b6c9969815e12743ca6978ecd26c95feb64fc95b217a0`.
Input terrain SHA256: `b8532036cf93e5ba9e7682e5041a69f216c47a91a955c372638e73dcb5a19d8d`.

The bounded replay builds the candidate Mountain corridor against the served final terrain, source Mountain region and actual final solid/bed inventory. `createCorridorArt(...).lampAnchors()` supplied the measured inventory, in Classic, Taylor and Newfoundland, both full and lite. All 657 targets pass in all six combinations. Maximum distance: full 11.495141 m; lite 11.977001 m. The formerly uncovered Alpine targets are at most 6.945053 m away, reservoir targets at most 5.599410 m, summit targets at most 7.159021 m, and garden 1.903732 m.

The candidate replay has 56 planned full / 34 planned lite, plus the independent stop fixture: 57/35 actual runtime anchors. **This is not a final bake count.** Replaying the unmodified planner against the final served geometry gave 53 full lamps rather than the baked 52: one lower-road post shifted and another nominal-plan post appeared. Those two lower-road rows are retained in `proof.json.changed` and must not be described as coverage-repair additions. They arise from the served final inventory versus the pre-corridor planning inventory. Final bake and strict test must establish the real final counts/positions. The three named additions are separate from that replay difference.

No new bake, actual Vitest, rendering budget, night capture or device acceptance is claimed. The six actual runtime-anchor measurement combinations passed. The proposed real test will intentionally fail on the old baked world and must run after a fresh bake. No native terrain/road/guard source, route, controller, lamp-kit shape, pool radius or point-light count changed.

## Files

- `/tmp/mountain-light-gap.patch`: source/test delta (plan.ts, plan/env.ts, plan/lamps.ts, mountain.ts, lights.ts, horizon-mountain-light-tiers.test.ts).
- `/tmp/mountain-light-gap/proof.json`: measured anchors, coverage, support and explicit replay limits.
- `/tmp/mountain-light-gap/source-hashes.json`: exact before/candidate file hashes.
- `/tmp/mountain-light-gap/rebuilt-corridor.json`: complete candidate Mountain corridor; replace only that entry in a temporary world for art-budget measurement.
- `/tmp/mountain-light-gap/current-corridor.json`: unchanged baked baseline Mountain corridor.
- `/tmp/mountain-light-gap/build.mjs`, `study.mjs`, `run.log`: reusable bounded shadow build/study and output. `CANDIDATE=1 node build.mjs`, then run study from the repository checkout so the native terrain asset resolves. All outputs go to `/tmp`.
