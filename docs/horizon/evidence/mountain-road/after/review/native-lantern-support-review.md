# Exhaustive native road-lantern support test

Proposal: `/tmp/mountain-native-furniture-test.patch`. Only `test/horizonNativeFurniture.test.ts` changes. Root remains the sole checkout writer. `git apply --check` passed; no test, TS/world import, bake or browser was run. Preimage/source/baked JSON hashes are in `BASE.json`.

The completed serial failure is the old sampled-count assertion: measured20, expected>20. The current baked plan has34 retained fixtures:23 roadLantern and11 bridgeLantern. The old loop can silently omit actual road lanterns when a newly projected station has no hypothetical shoulder site, or when the real post is anchored in a guard instead of the ground. This is not a reason to reduce the count threshold.

Two current roadLanterns are intentional masonry mounts, not bridge lamps:

| Fixture | Actual native support | Distance from native guard inner line | Plinth vertical interval | Local masonry body interval at nearest point |
|---|---|---:|---:|---:|
| `mountainV2.road.lamp.12` | `mountain-road:left:parapet:164` |0.019194843m inward|69.121–69.631|69.131219392–70.131219392|
| `mountainV2.road.lamp.14` | `mountain-road:right:parapet:224` |0.014256268m inward|73.073–73.583|72.923314787–73.923314787|

Their actual anchors are `[1325.312,69.271,678.203]` and `[1356.478,73.223,668.878]`. Their outward plinth edge lies about0.18065m/0.18574m into the masonry. `plan/lamps.ts:112–113,136` explicitly changes a road lantern to the guard line when its shoulder base is more than1.2m from the road. The kind remains roadLantern. Native `routeArt.ts:72–77` draws the relevant half-metre-thick body; the0.4m plinth is drawn by `kit/road/lamps.ts:73–76`. These posts therefore require a masonry anchorage test rather than a ground-foot test. Merely seeing a guard label or a nearby collider is not accepted.

The proposal preserves all six bends, every0.5m bend sample, both running lanes and the existing>20 minimum. It measures every actual roadLantern (all23 in this bake) and compares the measured ID list to the complete road-lantern list. It never consults projected `lampSetback` to decide whether a real fixture deserves testing.

For ground posts it tests all nine points of the actual rotated0.4×0.4m stone foot, using the same arm direction as `lampPlacement`, dry-ground/native-route occupancy and the unchanged0.141m support tolerance. For the two masonry mounts it checks every foot sample against water and all other Horizon/native routes and keepouts, excluding only the supporting main road. It additionally verifies a0.1×0.4×0.2m embedded portion of the drawn plinth lies within the actual native parapet body in both full and lite row sampling. The body reconstruction uses canonical native sample normals/widths, trims the collision run's extra end samples to its actual source s0/s1, and uses conservative endpoint height bounds. No furniture, guard, support mesh or source road is changed.

The current source indicates21 standing road posts and2 masonry mounts. Their complete support/occupancy assertions have not been executed in this review. Root should run this test serially after the active178-file run. Any newly exposed support/occupancy failure is a real open witness to diagnose, not a reason to skip the fixture or widen a tolerance. The separate11 bridgeLanterns retain the existing running-lane clearance checks; this scoped patch does not newly claim exhaustive bridge-fixture anchorage acceptance.

Identity correction: corridor guard IDs include the exact `mountainV2:` namespace. `parapetCells` now accepts a corridor ID only when it equals `mountainV2:${nativeGuard.id}` and the native kind is parapet. It does not strip an arbitrary prefix or weaken the match. This corrects the original unexecuted proposal, which compared the two namespaces directly.
