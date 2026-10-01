# Baseline attribution — final

Baseline `1cf76c551e6f49124b6257162bc4d36ca18d7bd1`; 30/30 files completed. FinishedAt: `2026-09-30T17:24:08Z`.

Existing failed current files selected by parent; one baseline replay per file. Current logs are historical serial results, not a replay of later applied fixes. Equal messages prove only the reported assertion witness recurs, not whole behavioral inheritance. Test source equality is measured now, not a snapshot at original execution. Runner errors are separate from assertion outcomes.

| File | Assertion comparison | Runner errors current / baseline | Test source same now |
|---|---|---|---|
| harbour-hercules.test.ts | 2 same exact reported witness | none / none | True |
| harbour-open-world.test.ts | 3 same exact reported witness | none / none | True |
| harbour-skate-model.test.ts | 1 different reported witness; 1 same exact reported witness | none / none | True |
| harbour-skate-presence.test.ts | 1 same exact reported witness | none / none | True |
| hearth-mountain-channel.test.ts | 1 same exact reported witness | none / none | True |
| hearth-mountain.test.ts | 1 current-only failure (baseline file completed) | none / none | False |
| horizonBeds.test.ts | 1 current-only failure (baseline file completed) | none / none | False |
| horizonBoardPace.test.ts | 2 current-only failure (baseline file completed) | none / none | True |
| horizonBoardThresholds.test.ts | 2 current-only failure (baseline file completed) | none / none | False |
| horizonCorridor.test.ts | 2 current-only failure (baseline file completed) | none / none | False |
| horizonMountainRegion.test.ts | 2 current-only failure (baseline file completed) | none / none | False |
| horizonMoversNoMoney.test.ts | 2 same exact reported witness | none / none | True |
| horizonRideSituations.test.ts | 2 current-only failure (baseline file completed) | none / none | True |
| horizonSkateLines.test.ts | 1 current-only failure (baseline file completed) | Error: [vitest-worker]: Timeout calling "onTaskUpdate" / Error: [vitest-worker]: Timeout calling "onTaskUpdate" | False |
| horizonStructures.test.ts | no assertion failures in either log | Error: [vitest-worker]: Timeout calling "onTaskUpdate" / Error: [vitest-worker]: Timeout calling "onTaskUpdate" | False |
| horizonUnderground.test.ts | 1 current-only failure (baseline file completed) | Error: [vitest-worker]: Timeout calling "onTaskUpdate" / Error: [vitest-worker]: Timeout calling "onTaskUpdate" | False |
| journey-board-route.test.ts | 1 current-only failure (baseline file completed) | none / none | True |
| journey-land.test.ts | 1 current-only failure (baseline file completed) | none / none | True |
| journey-road.test.ts | 7 current-only failure (baseline file completed) | none / none | False |
| mountain-branch-finishing.test.ts | 1 current-only failure (baseline file completed) | none / none | True |
| mountain-camera.test.ts | 1 same exact reported witness | none / none | True |
| skate-int-dressing.test.ts | 2 same exact reported witness | none / none | True |
| skate-int-feel.test.ts | 3 same exact reported witness | none / none | True |
| skate-int-grinds-human.test.ts | 2 same exact reported witness | none / none | True |
| skate-int-park.test.ts | 4 same exact reported witness | none / none | True |
| skate-lab.test.ts | 2 same exact reported witness | none / none | True |
| skate-look-craft.test.ts | 2 same exact reported witness | none / none | True |
| skate-show-framing.test.ts | 2 same exact reported witness | none / none | True |
| skate-world-mesh.test.ts | 4 same exact reported witness | none / none | True |
| skate-world.test.ts | 10 same exact reported witness | none / none | True |

## New or changed witnesses

Exact case names, full messages/diffs, numeric tokens and log hashes for every case are retained in the companion JSON. The table below previews only new or changed failures; a baseline runner error is not a clean process pass.

| File / case | Current message preview | Baseline |
|---|---|---|
| harbour-skate-model.test.ts: keeps every timed route segment clear in full and lite planting | AssertionError: expected [ …(9) ] to deeply equal [] | AssertionError: expected [ …(8) ] to deeply equal [] |
| hearth-mountain.test.ts: keeps the complete width of each optional branch supported, clear and inside the world | AssertionError: expected [ …(8) ] to deeply equal [] | No assertion failure in completed baseline file |
| horizonBeds.test.ts: D-D8: the lake-rim trail keeps its 2.5 m profile, the Year Walk carries the February share, and the trail ends on the sill's east lip (v2.6) | AssertionError: expected true to be false // Object.is equality | No assertion failure in completed baseline file |
| horizonBoardPace.test.ts: rolls S1's Crown drop at v2's Alpine bends pace on v2's paved road | AssertionError: expected { y: 145.59156808148583, …(10) } to match object { legal: true, pace: 'flow', …(6) } | No assertion failure in completed baseline file |
| horizonBoardPace.test.ts: samples every built threshold pad legal for the board and the bicycle: threshold pace, or a pick-up pad at its line's pace | AssertionError: expected { id: 'skateLineStarts.1', …(1) } to deeply equal { id: 'skateLineStarts.1', …(1) } | No assertion failure in completed baseline file |
| horizonBoardThresholds.test.ts: picks the board up at skateLineStarts.1 under the rider, clamped into the pad, stopped, gripped, facing down S1, at S1's pace | AssertionError: expected 0.04571560002903319 to be +0 // Object.is equality | No assertion failure in completed baseline file |
| horizonBoardThresholds.test.ts: puts terrain 3 m off S1 offbed, where the wheels dig in | AssertionError: expected { y: 123.21974245059977, …(10) } to match object { pace: 'offbed', legal: false, …(2) } | No assertion failure in completed baseline file |
| horizonCorridor.test.ts: builds each guard collider inside its visible line, never across a declared gap, and lists it by id | AssertionError: mountainV2:mountain-road:left:bridge:35: expected 0 to be greater than 0 | No assertion failure in completed baseline file |
| horizonCorridor.test.ts: carries one corridor per road bed with continuous stations and contiguous reaches | AssertionError: expected 19 to be 17 // Object.is equality | No assertion failure in completed baseline file |
| horizonMountainRegion.test.ts: the provider owns the ground: v2’s exact ground and decks win over the 5 m baked terrain | AssertionError: expected 0.0800000000000054 to be less than 1e-9 | No assertion failure in completed baseline file |
| horizonMountainRegion.test.ts: ground: region.groundAt(h) is v2 groundHeightAt(native) + 54 at 20 points | AssertionError: expected 54.569976964376 to be 54.649976964376 // Object.is equality | No assertion failure in completed baseline file |
| horizonRideSituations.test.ts: R3 Direction change | AssertionError: expected [ …(2) ] to deeply equal [] | No assertion failure in completed baseline file |
| horizonRideSituations.test.ts: keeps R1 Downhill carve explicitly deferred on v2's course (D-M5; measured: never reaches 120 m, stalls at 83.7 m) | AssertionError: expected 4.885120606377043 to be close to 83.75, received difference is 78.86487939362296, but expected 0.05 | No assertion failure in completed baseline file |
| horizonSkateLines.test.ts: S1 start → end | AssertionError: expected false to be true // Object.is equality | No assertion failure in completed baseline file |
| horizonUnderground.test.ts: encloses rooms and passages, preserves the only named mouths, and reports roof breaches | Error: Stillwater profile exceeds 10% at sample 1 | No assertion failure in completed baseline file |
| journey-board-route.test.ts: fits the L0 budget at Sky (≤ 40k tris / 60 draws full; ≤ 25k / 40 lite) and L1 at Region | AssertionError: lite sky triangles: expected 25839 to be less than or equal to 25000 | No assertion failure in completed baseline file |
| journey-land.test.ts: stays inside the land budget on full and lite | AssertionError: expected 16229 to be less than or equal to 15000 | No assertion failure in completed baseline file |
| journey-road.test.ts: draws the road's named spans as bridges, each carrying its road, with the deck's own axis and width | AssertionError: expected [ 'apronBridge', 'bightBridge', …(11) ] to deeply equal [ 'apronBridge', 'bightBridge', …(8) ] | No assertion failure in completed baseline file |
| journey-road.test.ts: marks the Prow gallery and the Mountain Road tunnel as covered, portal to portal | AssertionError: expected [ …(3) ] to deeply equal [ …(2) ] | No assertion failure in completed baseline file |
| journey-road.test.ts: without corridors: no boulevards, and everything else is exactly what the same index extracts with corridors | AssertionError: expected { revision: 'horizon-geo-1', …(17) } to strictly equal { revision: 'horizon-geo-1', …(17) } | No assertion failure in completed baseline file |
| journey-road.test.ts: the baked slim file is this format and decodes to what the index extracts, bridges and covers included | AssertionError: expected 13 to be 10 // Object.is equality | No assertion failure in completed baseline file |
| journey-road.test.ts: keeps every bridge, cover and boulevard clear of every station pad at its largest (Sky) size | AssertionError: stillwaterTunnel vs feb: expected 24.332077771875557 to be greater than 37.400000000000006 | No assertion failure in completed baseline file |
| journey-road.test.ts: authors the road's colours for every theme, and the flat twin draws the bridges at their true width | AssertionError: expected [ 'apronBridge', 'bightBridge', …(11) ] to deeply equal [ 'apronBridge', 'bightBridge', …(8) ] | No assertion failure in completed baseline file |
| journey-road.test.ts: stays inside the land budget on full and lite and recolours the bridges per theme | AssertionError: expected 3268 to be less than 1500 | No assertion failure in completed baseline file |
| mountain-branch-finishing.test.ts: rides the neighbourhood awning at race speed with full-tier solids | AssertionError: expected { speed: 8, bails: 1, arrived: true } to deeply equal { speed: 8, bails: +0, arrived: true } | No assertion failure in completed baseline file |

Totals: 42 same exact reported witness; 1 different reported witness; 24 current-only failure (baseline file completed).

Native emphasis: mountain-branch-finishing is current-only (8m/s, one bail, arrived:true; baseline test passes both speed iterations). Mountain-camera and every failed skate-* case reproduce the exact captured baseline diagnostic, including numeric values and array witnesses. harbour-skate-model adds only the full-tier gate9 chord obstruction; the other eight array witnesses remain present.

## Interpretation limits

A baseline process exit1 with all assertions passing remains a runner failure; it is not an application assertion failure or a successful run. A file that passes on baseline and fails currently is a current regression candidate, even if root has since applied an unverified correction. A repeated failure may short-circuit at the same first assertion and conceal additional behavior; equal witness is deliberately weaker than full inheritance. Any repaired current source needs a new result log after this comparison. Exact input files and hashes are in the JSON.
