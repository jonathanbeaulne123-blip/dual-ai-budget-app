# Acceptance disposition before final runs

Read-only review of current source and retained evidence; no imports, world generation, tests, renderer or checkout changes. This updates the stale `/tmp/mountain-current-test-triage.md`; it does not replace a final frozen-source lane. Evidence paths below are under `docs/horizon/evidence/mountain-road/` unless absolute. Exact saved native-failure comparisons and input hashes: `/tmp/mountain-native-footway-witness-disposition.json` (reproducer `/tmp/mountain-acceptance-disposition-build.py`).

**Do not mark complete:** D-MR17 accepts only four original main-road grade groups. It explicitly does not waive lips, gaps, failed routes, guards, collisions, headroom or new grades (`docs/DECISIONS.md:1818–1822`). An inherited test/footway failure remains a failure; changed failure coordinates are not an exact baseline witness. The approved shared landings, Awning, three road frames and Orchard are bounded repair authority, not blanket permission to reshape native access paths, water, stations or parapets.

## Native walking comparison

`after/attempts/expanded-native-footway-comparison/` replays all52 original native exported paths using the same current audit driver against separately bundled integrated-main/current worlds. Baseline104 attempts:74finish/30nonfinish. Current104:73finish/31nonfinish. The wider inventory is69 independent routes/138 directions:101finish/37nonfinish. These are provisional saved assets and independent placements, not a connected-network pass. Six-decimal path/kind/width equality proves only exported source identity.

Of the31 currently incomplete native attempts:

- **27 exact repeated captured witnesses** match reason, progress, finalXYZ, walkBlocker including floor/obstacle, contacts, airborne/offbed frames and bails. This includes **two invalid zero-length `link:lane-junction` starts**, not two successful walks. The other25 actual failed attempts are listed below.
- **One inherited obstruction with changed floor:** observatory approach forward still stalls at0.12m against `mountainV2:summit-art:parapet:2`, at the same plan point. New SummitStation join changes its supporting floor from stone158 to gravel158.001593425. Obstacle inheritance is exact; floor/XYZ are not.
- **One improved but incomplete route:** summit→summit-overlook forward changes from airborne at4.56m to stall at10.60m on43.8761278° terrain. The original failure is inherited; this later first-failure witness is new and must remain separately named. It is not an end-reaching walk or proven newly introduced terrain defect merely because the probe reaches farther.
- **Two genuine new regressions:** town-funicular→Foot completed both directions on main; current stalls forward4.48m at `[1287.377839526,55.194433360,724.785247771]`, next ground57.4682°, and reverse1.72m at `[1287.132355638,54.593013461,724.566814087]`, next ground58.9561°. This Horizon join requires repair and final proof; it is not covered by D-MR17.

Exact repeated native failures (F/R denotes direction; every numeric/contact witness is in the companion JSON):

| Native source | Directions |
|---|---|
| `stair:harbour-steps` | F/R |
| `path:town:north~path:river-west` | F/R |
| `path:road:library~apron:library` | F |
| `path:road:library~overlook:gorge-balcony` | F/R |
| `path:station:funicular:library~overlook:gorge-balcony` | F/R |
| `stair:dam-west-steps` | F/R |
| `path:dam:east~door:pavilion` | F/R |
| `path:door:pavilion~district:reservoir` | F |
| `path:station:funicular:reservoir~dam:east` | F/R |
| `path:district:library~road:b2-east` | F/R |
| `path:road:summit~district:summit` | F |
| `path:district:summit~door:observatory` | R |
| `path:district:summit~station:gondola:summit` | R |
| `path:district:summit~overlook:summit` | R |
| `town:west-lanes` | F/R |
| `path:road:clearing~gate:woodland-clearing` | F |

Summit→gondola forward improved from10.04m stall to15.56m/end. Keep that improvement separate from its exact inherited reverse failure.

## Changed geometry and other footways still requiring disposition

1. **Funicular candidate remains rejected.** The retained v12 full report (`after/attempts/funicular-foot-rejected-v12-full/results.json.gz`) explicitly has `accepted:false`: all14 short walks finish, but two town-station outer-width sweeps retain13 failures each, actual path art has728full/608lite buried samples per theme, and20 new/worsened boundary findings remain. Its shape-only38.338°/closed-solid pass is insufficient. The separate late-chunk region lifecycle defect also remains to integrate and prove. Keep v12 preloaded-only and rejected; do not turn14 finishes into completed join acceptance.
2. **Horizon `walk summit` is not an exact inherited outcome.** Earlier frozen source evidence establishes existing native parapet conflicts; it does not establish the expanded current first failures. Current forward stops0.36m on64.3593° terrain at `[1324.168873958,158.180000305,470.720973987]`; reverse stops12.64m against the newly authored `crownLaunch.stair.landingRails@crown`. That new rail contact cannot be labelled an unchanged native post. Preserve the original centreline failures and require a current legal-width ordinary-clearance pass or a visible Horizon repair. No baseline source hash or D-MR17 waiver closes it.
3. **FootQuay centreline hits an existing station post.** Both expanded attempts stop at `mountainV2:station-art:gondola:quay:post:1`. Earlier `/tmp/footquay-generic-cached-movement/` and `/tmp/footquay-clearance-proof.json` demonstrate ordinary steering around the real post inside the original2.5m footprint, both ways. This justifies retaining a separate clearance-policy follow-up, not deleting the centreline failures or moving native geometry. Repeat on final assets before claiming present access. This Horizon path has source-inheritance evidence, not an exact paired baseline controller run in the52-path comparison.
4. **Promenade metadata correction is not native access repair.** Expanded reports still contain the old13-point crest-plus-unsupported-chord attempt (52.95m/F,5.00m/R stalls). Current source now uses the real37-point `promenade:dam-crest`; both corresponding native crest attempts finish in the controlled comparison. Keep the removed phantom chord in historical evidence. `after/attempts/true-promenade-metadata/REVIEW.md` correctly retains the failed actual west stair, east pavilion and funicular approaches. No bridge is required merely to justify a false metadata chord, and no continuous approach is accepted by the metadata test.
5. **Old Crown/YearWalk/SummitStation/stair failures must not be recopied as current failures or successes.** The34-attempt `footways-before-ground-joins` checkpoint predates their repairs. Expanded current results complete Crown, SummitStation, Crown stair and the separately inventoried YearWalk clips. Their improved independent results are provisional; original Crown both-direction failures were real regressions against `before/modes`, subsequently addressed. They do not make all YearWalk or full-chain walking continuous.

## Test lane: what can and cannot be closed

- Historical178-file lane remains147pass/31fail. The integrated-main replay is11pass/19fail files out of30, with42 exact repeated assertion witnesses, one changed list and24 current-only assertion failures. `after/review/baseline-attribution.{md,json}` preserves exact cases and hashes. Same first assertion does not prove whole-file inheritance.
- Later focused evidence closes the introduced Awning branch/support assertions, MountainRegion ground expectation, Journey budgets/ownership, actual lamp-foot placement, BoardPace17/17 and BoardThresholds25/25 at their recorded checkpoints. The shared-surface, pickup and manifest-material changes are owning-layer fixes, not test waivers.
- **Update the old triage:** durable `after/attempts/current-ride-replays/beds-current.txt` is17/17 with exit0, so Beds is no longer an unverified complete-file gap. Corridor, Structures and Underground still lack a later complete clean-exit result in the reviewed supplied logs. Printed all-green assertions from an exit1/onTaskUpdate timeout remain failed processes. Final serial results must settle these.
- `harbour-skate-model` remains17/19: radius293.9919216577218 versus73.2 and the eight full/lite blocked chords exactly match main. The introduced ninth `full:mountain-descent:9` is gone. This is two inherited assertion witnesses, not a green suite.
- RideSituations7/7 asserts an explicitly failed/deferred R1 carve at83.9153837063m, below the unchanged120m target. SkateLines6pass/2todos includes S1 at301.1 simulated seconds over two legs across land defects, outside its70–130s target. These green expected-failure/split-run assertions cannot accept uninterrupted Mountain riding. Their historical test deferral is not an additional D-MR17 road exception.
- The old triage's final paragraph calling the ordered-shade proposal unexecuted is stale: later durable `after/rendering/shade-passes/` and the partitioned-shade budget evidence supersede it. Do not carry that old rendering status into the final disposition; final-bake whole-matrix checks still stand separately.

## Written choices actually outstanding

No new permission is needed to finish the authorized Horizon funicular/other physical joins, correct false source metadata, prove real support/clearance, retain failed evidence, or run the requested final lane. Existing Library/Dam/Awning/frame/Orchard approvals do not need reconfirmation.

A separate measured written choice is needed **only if** resolving a remaining access defect requires changing protected native path plans, native stairs/terrain/water/stations/parapets, adding a new landmark span/alignment, or explicitly narrowing the all-existing-footways acceptance requirement. No such blanket repair or failure waiver exists in the reviewed decisions. The failed west/east dam approaches and native Library/summit/river/woodland paths above therefore remain named access debt; inheritance alone cannot turn them into accepted exceptions. First determine whether ordinary movement inside the existing safe footprint or a bounded authorized Horizon join resolves each required connection. Do not ask for speculative broad native permission or claim an unbuilt alternative is ready.

The only concrete accepted failure class remains the four original main-road grade groups. Final book/LOOK should report actual completions and unchanged failures separately and must remain incomplete if the original required route/footway gates have not been met or explicitly revised by Jonathan.
